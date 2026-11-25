%% WISDOM digital shadow - validation experiment through the measurement interface
%
% External simulator for the experimental validation (software-in-the-loop).
% It reads the points and equation-only model values exported by the Digital
% Shadow page (wisdom-plan.csv), creates sensor readings for five scenarios and
% SENDS THEM THROUGH THE MEASUREMENT INTERFACE (HTTP POST /api/measure), exactly
% as a real sensor station would. The page then receives the readings on the
% Live link, compares them with the equation-only prediction and calibrates.
%
%   S0  ideal sensor, physical conditions exactly as the equations assume
%       -> the readings must equal the equation values (difference 0 dB)
%   S1  ideal sensor, physical conditions differ from the equations
%       (system offset, building and indoor losses, distance trend)
%   S2  realistic sensor (shadowing, fading, GPS, calibration, drift, 1 dB display)
%       with the same physical differences as S1
%   S3  realistic sensor, reality follows an independent model (3GPP close-in, n = 3)
%   S4  realistic sensor, reality follows an independent model (exact two-ray)
%
% Sensitivity analysis: icarc_validation('sensitivity') starts from the realistic
% sensor of S2 and makes one sensor problem worse at a time (GPS error, drift,
% fading averaging, display step, lost readings, shadowing).
%
% Output: icarc-sent.csv (or icarc-sens-sent.csv), the log of every reading sent and the true values.
% Works in MATLAB R2016b+ and GNU Octave 7+, no toolboxes. Uses curl in Octave.
% Run:  icarc_validation   or   icarc_validation('sensitivity')   (from the folder holding wisdom-plan.csv)

function icarc_validation(experiment)
if nargin < 1, experiment = 'main'; end

PLAN_FILE = 'wisdom-plan.csv';
SENT_FILE = 'icarc-sent.csv';
URL       = 'http://localhost:8795/api/measure';   % or https://groundwave-lab.pages.dev/api/measure
N_POINTS  = 80;                                     % readings per run
RUNS      = struct('S0',3,'S1',3,'S2',8,'S3',8,'S4',8);
SEED      = 2027;

HIDDEN = struct('offset',-4.0,'built',-8.6,'indoor',-3.5,'trend',-3.2);   % S1-S4 "physical conditions"
NONE   = struct('offset',0,'built',0,'indoor',0,'trend',0);
IDEAL  = struct('truth_model','website','shadow_db',0,'decorr_m',20,'fade_k',0,'gps_m',0,'rx_cal_db',0,'drift_db_h',0,'quant_db',0,'sens_dbm',-200,'loss_pct',0);
REAL   = struct('truth_model','website','shadow_db',4,'decorr_m',20,'fade_k',40,'gps_m',3,'rx_cal_db',1.5,'drift_db_h',0.5,'quant_db',1,'sens_dbm',-100,'loss_pct',0);

rand('seed', SEED); randn('seed', SEED);   %#ok<RAND>
if exist('rng','builtin') || exist('rng','file'), rng(SEED); end
P = ic_readplan(PLAN_FILE);
fprintf('Plan: %d points, station %.5f, %.5f, %g MHz, ERP %g kW\n', numel(P.lat), P.tw.lat, P.tw.lon, P.tw.f, P.tw.erp);

if strcmp(experiment, 'sensitivity')
  % one factor at a time, everything else as the realistic sensor of S2
  SENT_FILE = 'icarc-sens-sent.csv'; REPS = 4;
  F = {'gps_m', [0 3 10 25]; 'drift_db_h', [0 0.5 2 5]; 'fade_k', [0 1 10 40]; 'quant_db', [0 1 3]; 'loss_pct', [0 20 50]; 'shadow_db', [2 4 6]};
  SC = {}; RUNS = struct();
  for fi = 1:size(F, 1)
    for v = F{fi, 2}
      key = sprintf('E_%s_%s', strrep(F{fi,1}, '_', ''), strrep(sprintf('%g', v), '.', 'p'));
      SC(end+1, :) = {key, HIDDEN, setfield(REAL, F{fi,1}, v), F{fi,1}, v}; %#ok<AGROW>
      RUNS.(key) = REPS;
    end
  end
else
  SC = {'S0', NONE, IDEAL, 'none', 0; 'S1', HIDDEN, IDEAL, 'none', 0; 'S2', HIDDEN, REAL, 'none', 0; 'S3', HIDDEN, setfield(REAL,'truth_model','closein'), 'none', 0; 'S4', HIDDEN, setfield(REAL,'truth_model','tworay'), 'none', 0};
end
fs = fopen(SENT_FILE, 'w');
fprintf(fs, 'channel,scenario,run,sensor,lat,lon,level_sent,equation_only,true_level_noiseless,dist_km,built,indoor,truth_model,offset,built_loss,indoor_loss,trend,factor,value\n');
for s = 1:size(SC,1)
  name = SC{s,1}; TR = SC{s,2}; S = SC{s,3}; fac = SC{s,4}; val = SC{s,5};
  for r = 1:RUNS.(name)
    ch = lower(strrep(sprintf('icarc-%s-r%02d', name, r), '_', '-'));
    idx = randperm(numel(P.lat)); pick = idx(1:N_POINTS);
    [lv, la, lo, keep, Enl] = ic_sense(P, pick, TR, S);
    t = P.tw;
    ic_send(sprintf('%s?ch=%s', URL, ch), sprintf('{"tx":{"name":"WISDOM station (validation)","lat":%.7f,"lon":%.7f,"h":%g,"f_mhz":%g,"erp_kw":%.6g}}', t.lat, t.lon, t.h, t.f, t.erp));
    parts = {};
    for j = find(keep)
      i = pick(j); sn = sprintf('%s-r%02d-p%03d', name, r, j);
      parts{end+1} = sprintf('{"sensor":"%s","lat":%.7f,"lon":%.7f,"level":%.4f,"f_mhz":%g,"h":%g,"built":%d,"indoor":%d,"fixed":0,"src":"octave"}', sn, la(j), lo(j), lv(j), t.f, P.h(i), P.built(i), P.indoor(i)); %#ok<AGROW>
      fprintf(fs, '%s,%s,%d,%s,%.7f,%.7f,%.4f,%.4f,%.4f,%.4f,%d,%d,%s,%g,%g,%g,%g,%s,%g\n', ch, name, r, sn, la(j), lo(j), lv(j), P.model(i), Enl(j), P.dist(i), P.built(i), P.indoor(i), S.truth_model, TR.offset, TR.built, TR.indoor, TR.trend, fac, val);
    end
    ic_send(sprintf('%s?ch=%s', URL, ch), ['{"readings":[' strjoin(parts, ',') ']}']);
    fprintf('%s: sent %d readings to channel %s\n', name, numel(parts), ch);
  end
end
fclose(fs);
fprintf('Log written to %s\n', SENT_FILE);
end

%% ---------------------------------------------------------------------------
function [lv, la, lo, keep, Enl] = ic_sense(P, pick, TR, S)
  pick = pick(:)'; m = numel(pick); d = max(P.dist(pick), 0.05);
  Enl = ic_baseline(P, pick, S.truth_model) + TR.offset + TR.built * P.built(pick) + TR.indoor * P.indoor(pick) + TR.trend * log10(d);
  E = Enl;
  if S.shadow_db > 0      % spatially correlated shadowing (Gudmundson 1991)
    [x, y] = ic_xy(P.lat(pick), P.lon(pick), P.tw.lat, P.tw.lon);
    D = sqrt((x' - x).^2 + (y' - y).^2);
    C = S.shadow_db^2 * exp(-D / max(S.decorr_m, 0.01)) + 1e-6 * eye(m);
    E = E + (chol(C, 'lower') * randn(m, 1))';
  end
  if S.fade_k >= 1        % Rayleigh fading averaged over fade_k samples in power (Lee 1985)
    E = E + 10 * log10(mean(-log(rand(m, round(S.fade_k))), 2))';
  end
  E = E + S.rx_cal_db + S.drift_db_h * (0:m-1) / 60;     % calibration error and warm-up drift
  if S.quant_db > 0, E = round(E / S.quant_db) * S.quant_db; end
  keep = E >= S.sens_dbm + 20 * log10(P.tw.f) + 77.2;
  if S.loss_pct > 0, keep = keep & (rand(1, m) >= S.loss_pct / 100); end
  la = P.lat(pick) + S.gps_m * randn(1, m) / 110540;
  lo = P.lon(pick) + S.gps_m * randn(1, m) ./ (111320 * cos(P.lat(pick) * pi / 180));
  lv = E;
end

function E = ic_baseline(P, pick, which)
  f = P.tw.f; d_km = max(P.dist(pick), 0.005); d_m = d_km * 1000;
  Efs = 74.77 + 10 * log10(P.tw.erp * 1000) + 2.15 - 20 * log10(d_km);   % free-space field strength from EIRP
  switch which
    case 'website', E = P.model(pick); return
    case 'closein', E = Efs - 10 * (3 - 2) * log10(d_m);                     % 3GPP close-in, n = 3
    case 'tworay'
      lam = 300 / f; ht = P.tw.h + max(P.tw.g - P.g(pick), -P.tw.h + 1); hr = P.h(pick);
      dphi = 2 * pi / lam * (sqrt(d_m.^2 + (ht + hr).^2) - sqrt(d_m.^2 + (ht - hr).^2));
      E = Efs + max(20 * log10(abs(1 - exp(1i * dphi))), -30);
  end
  E = E + P.ant(pick) - 10 * P.built(pick) - 12 * P.indoor(pick);
end

function [x, y] = ic_xy(lat, lon, lat0, lon0)
  x = (lon - lon0) .* cos(lat0 * pi / 180) * 111320; y = (lat - lat0) * 110540;
end

function P = ic_readplan(file)
  fid = fopen(file, 'r'); if fid < 0, error('Cannot open %s. On the page press "Export points for MATLAB".', file); end
  tl = ''; rows = {};
  while true
    L = fgetl(fid); if ~ischar(L), break; end
    L = strtrim(L); if isempty(L), continue; end
    if strncmp(L, '#tower', 6), tl = L; continue; end
    if strncmp(L, 'name,', 5), continue; end
    rows{end+1} = L; %#ok<AGROW>
  end
  fclose(fid);
  t = strsplit(tl, ',');
  P.tw = struct('lat', str2double(t{2}), 'lon', str2double(t{3}), 'h', str2double(t{4}), 'g', str2double(t{5}), 'f', str2double(t{6}), 'erp', str2double(t{7}));
  n = numel(rows); V = zeros(n, 10); P.name = cell(1, n);
  for i = 1:n
    L = rows{i}; q = find(L == '"');
    if numel(q) >= 2, P.name{i} = L(q(1)+1:q(2)-1); L = L(q(2)+2:end); else, c = strfind(L, ','); P.name{i} = L(1:c(1)-1); L = L(c(1)+1:end); end
    c = strsplit(L, ','); V(i, :) = str2double(c(1:10));
  end
  P.lat = V(:,1)'; P.lon = V(:,2)'; P.h = V(:,3)'; P.g = V(:,4)'; P.sensor = V(:,5)';
  P.built = V(:,6)'; P.indoor = V(:,7)'; P.dist = V(:,8)'; P.ant = V(:,9)'; P.model = V(:,10)';
end

function ic_send(url, body)
  try
    if exist('OCTAVE_VERSION', 'builtin'), error('use curl'); end
    webwrite(url, body, weboptions('MediaType', 'application/json', 'Timeout', 15));
  catch
    f = [tempname '.json']; fid = fopen(f, 'w'); fwrite(fid, body); fclose(fid);
    [st, msg] = system(sprintf('curl -s -X POST -H "Content-Type: application/json" --data-binary @"%s" "%s"', f, url));
    delete(f); if st ~= 0, warning('Sending failed: %s', msg); end
  end
end
