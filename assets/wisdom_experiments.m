%% WISDOM digital shadow - MATLAB sensor model and experiments (software-in-the-loop)
%
% MATLAB plays the sensors. It takes the points and model values exported by the
% Digital Shadow page (wisdom-plan.csv), adds a hidden "reality" that you choose
% (the answer), plus realistic sensor effects, and writes readings. The page then
% calibrates every case, and this script checks whether the page found the answer.
%
%   MODE = 'experiments'  make wisdom-experiments.csv + wisdom-truth.csv  (step 2)
%   MODE = 'plots'        read wisdom-results.csv from the page, make tables and figures (step 4)
%   MODE = 'live'         stream one realistic sensor to the page's Live link (for a demo)
%
% Works in MATLAB R2016b or newer and in GNU Octave 7 or newer. No toolboxes needed.
% Groundwave Propagation Lab - https://groundwave-lab.pages.dev  (Shadow tab)

MODE = 'experiments';

PLAN_FILE    = 'wisdom-plan.csv';          % from the page: "Export points for MATLAB"
OUT_FILE     = 'wisdom-experiments.csv';   % give this to the page: "Run wisdom-experiments.csv"
TRUTH_FILE   = 'wisdom-truth.csv';         % the hidden answers (kept here, never sent)
RESULTS_FILE = 'wisdom-results.csv';       % from the page: "Download results"
SEED         = 1;                          % same seed = same experiment, so results can be repeated

% ---- the hidden "reality": what the page has to find (dB) ----
TRUTH.offset = -4.0;   % whole-system error: cable loss, real power lower than stated
TRUTH.built  = -8.6;   % extra loss behind buildings that the model misses
TRUTH.indoor = -3.5;   % extra loss indoors
TRUTH.trend  = -3.2;   % dB per tenfold distance: the real slope differs from the model

% ---- the sensor model: set a value to 0 to switch that effect off ----
SENSOR.truth_model = 'website'; % 'website' (same model as the page), 'closein' or 'tworay' (independent models)
SENSOR.shadow_db   = 4;     % slow random ups and downs from trees and walls (std, dB)
SENSOR.decorr_m    = 20;    % ...points closer than this are similar (Gudmundson model)
SENSOR.fade_k      = 40;    % fast fading samples averaged per reading (40 wavelengths, Lee); 1 = no averaging; 0 = no fading
SENSOR.gps_m       = 3;     % GPS position error (std, metres)
SENSOR.rx_cal_db   = 1.5;   % receiver reads this much too high (calibration error)
SENSOR.drift_db_h  = 0.5;   % receiver drift with warming up (dB per hour, one reading per minute)
SENSOR.quant_db    = 1;     % receiver shows whole dB only
SENSOR.sens_dbm    = -100;  % weaker than this is not received
SENSOR.loss_pct    = 0;     % readings lost on the way (%)

% ---- experiment sizes ----
N_TEST   = 40;              % points kept aside to test each calibration (never used to fit)
N_TRAIN  = 40;              % training points in E1, E3, E4
REPEATS  = 15;              % repeats of every case with fresh random sensor effects
E2_N     = [5 8 12 16 20 30 40];   % E2: number of training readings
E2_SHADOW= [2 4 6];                % E2: shadowing levels (dB)

% ---- live mode ----
CHANNEL = 'wisdom-lab1';    % same as the Live link channel on the page
PERIOD  = 2;                % seconds between readings
URL     = 'https://groundwave-lab.pages.dev/api/measure';

switch MODE
  case 'experiments', wx_experiments(PLAN_FILE, OUT_FILE, TRUTH_FILE, TRUTH, SENSOR, N_TEST, N_TRAIN, REPEATS, E2_N, E2_SHADOW, SEED);
  case 'plots',       wx_plots(TRUTH_FILE, RESULTS_FILE);
  case 'live',        wx_live(PLAN_FILE, TRUTH, SENSOR, CHANNEL, PERIOD, URL, SEED);
  otherwise, error('MODE must be ''experiments'', ''plots'' or ''live''.');
end

%% =====================================================================
%% functions
%% =====================================================================

function wx_experiments(planFile, outFile, truthFile, TR, S0, nTest, nTrain, reps, e2n, e2s, seed)
  rand('seed', seed); randn('seed', seed);                     %#ok<RAND> works in MATLAB and Octave
  if exist('rng','builtin') || exist('rng','file'), rng(seed); end
  P = wx_readplan(planFile);
  n = numel(P.lat);
  fprintf('Plan: %d points, tower at %.5f, %.5f, %g MHz\n', n, P.tw.lat, P.tw.lon, P.tw.f);
  if n < nTest + max([nTrain e2n]), error('The plan has %d points; need at least %d. Lower N_TEST or N_TRAIN.', n, nTest + max([nTrain e2n])); end

  fo = fopen(outFile, 'w'); ft = fopen(truthFile, 'w');
  fprintf(fo, '%s\n', P.towerLine);
  fprintf(fo, 'case,experiment,lat,lon,level,built,height,indoor,fixed,test,ground\n');
  fprintf(ft, 'case,experiment,factor,value,truth_model,n_train,offset,built,indoor,trend,shadow_db,gps_m,fade_k,drift_db_h,loss_pct,quant_db\n');
  k = 0;

  % E1: can the page find the hidden errors?
  for r = 1:reps
    k = k + 1; wx_case(fo, ft, sprintf('E1-%03d', r), 'E1 find hidden errors', 'none', 0, P, TR, S0, nTrain, nTest);
  end
  % E2: how many readings are needed? (different shadowing levels)
  for s = e2s
    for m = e2n
      for r = 1:reps
        S = S0; S.shadow_db = s;
        k = k + 1; wx_case(fo, ft, sprintf('E2-s%d-n%02d-%03d', s, m, r), 'E2 readings needed', sprintf('shadow%d', s), m, P, TR, S, m, nTest);
      end
    end
  end
  % E3: reality follows a different propagation model than the page
  models = {'website', 'closein', 'tworay'};
  for mi = 1:numel(models)
    for r = 1:reps
      S = S0; S.truth_model = models{mi};
      k = k + 1; wx_case(fo, ft, sprintf('E3-%s-%03d', models{mi}, r), 'E3 other model', models{mi}, mi, P, TR, S, nTrain, nTest);
    end
  end
  % E4: bad conditions, one at a time
  F = {'gps_m', [0 3 10 25]; 'drift_db_h', [0 0.5 2 5]; 'fade_k', [0 1 10 40]; 'loss_pct', [0 20 50]; 'quant_db', [0 1 3]};
  for fi = 1:size(F, 1)
    vals = F{fi, 2};
    for v = vals
      for r = 1:reps
        S = S0; S.(F{fi, 1}) = v;
        k = k + 1; wx_case(fo, ft, sprintf('E4-%s-%g-%03d', F{fi, 1}, v, r), 'E4 bad conditions', F{fi, 1}, v, P, TR, S, nTrain, nTest);
      end
    end
  end
  fclose(fo); fclose(ft);
  fprintf('Wrote %d cases to %s and the answers to %s.\n', k, outFile, truthFile);
  fprintf('Next: on the page press "Run wisdom-experiments.csv" and choose %s.\n', outFile);
end

function wx_case(fo, ft, id, exper, factor, value, P, TR, S, nTrain, nTest)
  n = numel(P.lat); idx = randperm(n);
  te = idx(1:nTest); tr = idx(nTest+1:nTest+nTrain);
  pick = [tr te]; isTest = [zeros(1, numel(tr)) ones(1, numel(te))];
  [lv, la, lo, keep] = wx_sense(P, pick, TR, S, 0);
  for j = find(keep)
    i = pick(j);
    fprintf(fo, '%s,%s,%.7f,%.7f,%.2f,%d,%g,%d,%d,%d,%g\n', id, exper, la(j), lo(j), lv(j), P.built(i), P.h(i), P.indoor(i), P.sensor(i), isTest(j), P.g(i));
  end
  % the offset the page should find also contains the receiver error and the mean drift over the walk
  tmid = (numel(pick) - 1) / 2 / 60;
  off = TR.offset + S.rx_cal_db + S.drift_db_h * tmid;
  fprintf(ft, '%s,%s,%s,%g,%s,%d,%.3f,%.3f,%.3f,%.3f,%g,%g,%g,%g,%g,%g\n', id, exper, factor, value, S.truth_model, nTrain, off, TR.built, TR.indoor, TR.trend, ...
          S.shadow_db, S.gps_m, S.fade_k, S.drift_db_h, S.loss_pct, S.quant_db);
end

% ---- the sensor model: one reading per chosen point ----
function [lv, la, lo, keep] = wx_sense(P, pick, TR, S, t0)
  pick = pick(:)'; m = numel(pick);
  d  = max(P.dist(pick), 0.05);
  base = wx_baseline(P, pick, S.truth_model);
  E = base + TR.offset + TR.built * P.built(pick) + TR.indoor * P.indoor(pick) + TR.trend * log10(d);
  % slow shadowing, correlated in space (Gudmundson): nearby points get similar values
  if S.shadow_db > 0
    [x, y] = wx_xy(P.lat(pick), P.lon(pick), P.tw.lat, P.tw.lon);
    D = sqrt((x' - x).^2 + (y' - y).^2);   % needs R2016b+ implicit expansion (also in Octave)
    C = S.shadow_db^2 * exp(-D / max(S.decorr_m, 0.01)) + 1e-6 * eye(m);
    E = E + (chol(C, 'lower') * randn(m, 1))';
  end
  % fast fading (Rayleigh), averaged over fade_k samples in power
  if S.fade_k >= 1
    pw = -log(rand(m, round(S.fade_k)));
    E = E + 10 * log10(mean(pw, 2))';
  end
  % receiver: calibration error, drift while warming up (one reading per minute), whole-dB display
  t = t0 + (0:m-1) / 60;
  E = E + S.rx_cal_db + S.drift_db_h * t;
  if S.quant_db > 0, E = round(E / S.quant_db) * S.quant_db; end
  % too weak to receive, or lost on the way
  Emin = S.sens_dbm + 20 * log10(P.tw.f) + 77.2;
  keep = E >= Emin;
  if S.loss_pct > 0, keep = keep & (rand(1, m) >= S.loss_pct / 100); end
  % GPS: the position written down is a few metres off
  la = P.lat(pick) + S.gps_m * randn(1, m) / 110540;
  lo = P.lon(pick) + S.gps_m * randn(1, m) ./ (111320 * cos(P.lat(pick) * pi / 180));
  lv = E;
end

% ---- "reality" before the hidden errors: the page's own model, or an independent one ----
function E = wx_baseline(P, pick, which)
  f = P.tw.f; d_km = max(P.dist(pick), 0.005); d_m = d_km * 1000;
  eirp_dbw = 10 * log10(P.tw.erp * 1000) + 2.15;          % ERP (kW) -> EIRP (dBW)
  Efs = 74.77 + eirp_dbw - 20 * log10(d_km);               % free-space field strength, dBuV/m
  switch which
    case 'website'
      E = P.model(pick); return
    case 'closein'   % 3GPP close-in model, exponent 3 (urban outdoor)
      E = Efs - 10 * (3 - 2) * log10(d_m);
    case 'tworay'    % exact two-ray: direct + ground reflection (reflection coefficient -1)
      lam = 300 / f; ht = P.tw.h + max(P.tw.g - P.g(pick), -P.tw.h + 1); hr = P.h(pick);
      dphi = 2 * pi / lam * (sqrt(d_m.^2 + (ht + hr).^2) - sqrt(d_m.^2 + (ht - hr).^2));
      E = Efs + max(20 * log10(abs(1 - exp(1i * dphi))), -30);
    otherwise
      error('truth_model must be website, closein or tworay');
  end
  % independent models know nothing about buildings or walls: typical losses
  E = E + P.ant(pick) - 10 * P.built(pick) - 12 * P.indoor(pick);
end

function [x, y] = wx_xy(lat, lon, lat0, lon0)
  x = (lon - lon0) .* cos(lat0 * pi / 180) * 111320;
  y = (lat - lat0) * 110540;
end

% ---- read the plan exported by the page ----
function P = wx_readplan(file)
  fid = fopen(file, 'r');
  if fid < 0, error('Cannot open %s. On the page press "Export points for MATLAB" and save it next to this script.', file); end
  P.towerLine = ''; rows = {};
  while true
    L = fgetl(fid); if ~ischar(L), break; end
    L = strtrim(L); if isempty(L), continue; end
    if strncmp(L, '#tower', 6), P.towerLine = L; continue; end
    if strncmp(L, 'name,', 5), continue; end
    rows{end+1} = L; %#ok<AGROW>
  end
  fclose(fid);
  if isempty(P.towerLine), error('%s has no #tower line. Export it again from the page.', file); end
  t = strsplit(P.towerLine, ',');
  P.tw = struct('lat', str2double(t{2}), 'lon', str2double(t{3}), 'h', str2double(t{4}), 'g', str2double(t{5}), ...
                'f', str2double(t{6}), 'erp', str2double(t{7}), 'ant', t{8});
  n = numel(rows); V = zeros(n, 10); P.name = cell(1, n);
  for i = 1:n
    L = rows{i};
    q = find(L == '"');
    if numel(q) >= 2, P.name{i} = L(q(1)+1:q(2)-1); L = L(q(2)+2:end); else, c = strfind(L, ','); P.name{i} = L(1:c(1)-1); L = L(c(1)+1:end); end
    c = strsplit(L, ',');
    V(i, :) = str2double(c(1:10));
  end
  P.lat = V(:,1)'; P.lon = V(:,2)'; P.h = V(:,3)'; P.g = V(:,4)'; P.sensor = V(:,5)';
  P.built = V(:,6)'; P.indoor = V(:,7)'; P.dist = V(:,8)'; P.ant = V(:,9)'; P.model = V(:,10)';
end

% ---- read a CSV with a header line into a struct of columns (numbers where possible) ----
function T = wx_readcsv(file)
  fid = fopen(file, 'r');
  if fid < 0, error('Cannot open %s.', file); end
  H = ''; while isempty(H) || H(1) == '#', H = strtrim(fgetl(fid)); end
  names = strsplit(H, ','); raw = {};
  while true
    L = fgetl(fid); if ~ischar(L), break; end
    if isempty(strtrim(L)) || L(1) == '#', continue; end
    raw(end+1, :) = strsplit(L, ',', 'CollapseDelimiters', false); %#ok<AGROW>
  end
  fclose(fid);
  for j = 1:numel(names)
    v = str2double(raw(:, j));
    if all(isnan(v)) && ~all(cellfun(@isempty, raw(:, j))), T.(names{j}) = raw(:, j); else, T.(names{j}) = v; end
  end
end

% ---- step 4: compare the page's results with the hidden answers ----
function wx_plots(truthFile, resultsFile)
  Tt = wx_readcsv(truthFile); R = wx_readcsv(resultsFile);
  [ok, loc] = ismember(Tt.case, R.case);
  if ~any(ok), error('No case in %s matches %s. Run the same wisdom-experiments.csv on the page first.', resultsFile, truthFile); end
  g = @(f) R.(f)(loc(ok));
  c = Tt.case(ok); ex = Tt.experiment(ok); fac = Tt.factor(ok); val = Tt.value(ok); mdl = Tt.truth_model(ok);
  nTr = Tt.n_train(ok); sh = Tt.shadow_db(ok);
  tOff = Tt.offset(ok); tB = Tt.built(ok); tI = Tt.indoor(ok); tTr = Tt.trend(ok);
  rOff = g('offset'); rB = g('built'); rI = g('indoor'); rTr = g('trend');
  teB = g('rms_test_before'); teA = g('rms_test_after');
  fprintf('\nMatched %d of %d cases.\n', sum(ok), numel(Tt.case));
  fh = fopen('wisdom-paper-tables.txt', 'w'); out = @(varargin) wx_both(fh, varargin{:});

  % ---- E1 ----
  e1 = strncmp(c, 'E1', 2);
  if any(e1)
    out('\nTable 1 - E1: hidden errors and what the digital shadow found (%d repeats)\n', sum(e1));
    out('%-26s %10s %20s %12s\n', 'Hidden error', 'True (dB)', 'Found (mean +- std)', 'Error (dB)');
    nm = {'System offset', 'Behind buildings', 'Indoors', 'Trend (per decade)'};
    tv = {tOff, tB, tI, tTr}; rv = {rOff, rB, rI, rTr};
    for i = 1:4
      t = tv{i}(e1); r = rv{i}(e1); m = ~isnan(r);
      out('%-26s %10.2f %12.2f +- %5.2f %12.2f\n', nm{i}, mean(t), mean(r(m)), std(r(m)), mean(r(m) - t(m)));
    end
    out('Test error (points not used to fit): %.2f dB before -> %.2f dB after calibration\n', mean(teB(e1)), mean(teA(e1)));
    tm = [mean(tOff(e1)) mean(tB(e1)) mean(tI(e1)) mean(tTr(e1))];
    rm = [wx_nm(rOff(e1)) wx_nm(rB(e1)) wx_nm(rI(e1)) wx_nm(rTr(e1))];
    rs = [wx_ns(rOff(e1)) wx_ns(rB(e1)) wx_ns(rI(e1)) wx_ns(rTr(e1))];
    try
    figure('Name', 'E1'); hold on;
    bar(1:4, [tm' rm']); errorbar((1:4) + 0.14, rm, rs, 'k.');
    set(gca, 'XTick', 1:4, 'XTickLabel', {'Offset', 'Buildings', 'Indoor', 'Trend'}); ylabel('dB'); grid on;
    legend({'Hidden (true)', 'Found by the digital shadow'}, 'Location', 'southwest'); title('E1: hidden errors recovered');
    print('-dpng', '-r150', 'wisdom-E1.png');
    catch err, fprintf('  (figure E1 skipped: %s)\n', err.message); end
  end

  % ---- E2 ----
  e2 = strncmp(c, 'E2', 2);
  if any(e2)
    out('\nTable 2 - E2: test error after calibration (dB) vs number of training readings\n');
    ss = unique(sh(e2))'; nn = unique(nTr(e2))';
    out('%-10s', 'Readings'); for s = ss, out('%14s', sprintf('shadow %g dB', s)); end; out('\n');
    lg = {};
    M = zeros(numel(nn), numel(ss));
    for a = 1:numel(nn)
      for b = 1:numel(ss)
        sel = e2 & nTr == nn(a) & sh == ss(b); M(a, b) = wx_nm(teA(sel));
      end
    end
    for a = 1:numel(nn), out('%-10d', nn(a)); out('%14.2f', M(a, :)); out('\n'); end
    try
    figure('Name', 'E2'); hold on;
    for b = 1:numel(ss), plot(nn, M(:, b), '-o', 'LineWidth', 1.5); lg{end+1} = sprintf('shadowing %g dB', ss(b)); end %#ok<AGROW>
    xlabel('Training readings'); ylabel('Test error after calibration (dB RMS)'); grid on; legend(lg); title('E2: how many readings are needed');
    print('-dpng', '-r150', 'wisdom-E2.png');
    catch err, fprintf('  (figure E2 skipped: %s)\n', err.message); end
  end

  % ---- E3 ----
  e3 = strncmp(c, 'E3', 2);
  if any(e3)
    out('\nTable 3 - E3: reality follows another propagation model\n');
    out('%-12s %16s %16s\n', 'Reality', 'Before (dB)', 'After (dB)');
    ms = unique(mdl(e3)); B = zeros(numel(ms), 2);
    for i = 1:numel(ms)
      sel = e3 & strcmp(mdl, ms{i}); B(i, :) = [wx_nm(teB(sel)) wx_nm(teA(sel))];
      out('%-12s %16.2f %16.2f\n', ms{i}, B(i, 1), B(i, 2));
    end
    try
    figure('Name', 'E3'); bar(B); set(gca, 'XTick', 1:numel(ms), 'XTickLabel', ms); ylabel('Test error (dB RMS)'); grid on;
    legend({'Before calibration', 'After calibration'}); title('E3: model mismatch');
    print('-dpng', '-r150', 'wisdom-E3.png');
    catch err, fprintf('  (figure E3 skipped: %s)\n', err.message); end
  end

  % ---- E4 ----
  e4 = strncmp(c, 'E4', 2);
  if any(e4)
    out('\nTable 4 - E4: bad conditions (one at a time)\n');
    out('%-12s %8s %18s %18s\n', 'Effect', 'Value', 'Test error (dB)', 'Buildings error');
    fs = unique(fac(e4)); PL = cell(numel(fs), 3);
    for i = 1:numel(fs)
      sel = e4 & strcmp(fac, fs{i}); vs = unique(val(sel))'; ye = []; yb = [];
      for v = vs
        s2 = sel & val == v; ye(end+1) = wx_nm(teA(s2)); yb(end+1) = wx_nm(abs(rB(s2) - tB(s2))); %#ok<AGROW>
        out('%-12s %8g %18.2f %18.2f\n', fs{i}, v, ye(end), yb(end));
      end
      PL(i, :) = {vs, ye, yb};
    end
    try
    figure('Name', 'E4');
    for i = 1:numel(fs)
      subplot(1, numel(fs), i); plot(PL{i,1}, PL{i,2}, '-o', PL{i,1}, PL{i,3}, '-s', 'LineWidth', 1.4); grid on;
      xlabel(strrep(fs{i}, '_', ' ')); if i == 1, ylabel('dB'); legend({'test error', '|buildings error|'}, 'Location', 'northwest'); end
    end
    print('-dpng', '-r150', 'wisdom-E4.png');
    catch err, fprintf('  (figure E4 skipped: %s)\n', err.message); end
  end
  fclose(fh);
  fprintf('\nSaved wisdom-paper-tables.txt and the figures wisdom-E1.png ... wisdom-E4.png\n');
end

function wx_both(fh, varargin)
  fprintf(varargin{:}); fprintf(fh, varargin{:});
end
function m = wx_nm(v), v = v(~isnan(v)); if isempty(v), m = NaN; else, m = mean(v); end, end
function s = wx_ns(v), v = v(~isnan(v)); if numel(v) < 2, s = 0; else, s = std(v); end, end

% ---- live: one realistic sensor walking the route, plus the fixed sensors ----
function wx_live(planFile, TR, S, ch, period, url, seed)
  rand('seed', seed); randn('seed', seed); %#ok<RAND>
  P = wx_readplan(planFile);
  route = find(~strncmp(P.name, 'Pool', 4));            % the page's sensors and walk test
  if isempty(route), route = 1:min(30, numel(P.lat)); end
  t = P.tw; full = sprintf('%s?ch=%s', url, ch);
  wx_send(full, sprintf('{"tx":{"name":"WISDOM station (MATLAB sensor model)","lat":%.6f,"lon":%.6f,"h":%g,"f_mhz":%g,"erp_kw":%g}}', t.lat, t.lon, t.h, t.f, t.erp));
  fprintf('Streaming %d points to channel %s every %g s. Press Ctrl+C to stop.\n', numel(route), ch, period);
  k = 0;
  while true
    for i = route
      k = k + 1;
      [lv, la, lo, keep] = wx_sense(P, i, TR, S, k / 60);
      if ~keep, fprintf('  %s: not received\n', P.name{i}); pause(period); continue; end
      body = sprintf('{"readings":[{"sensor":"%s","lat":%.7f,"lon":%.7f,"level":%.2f,"f_mhz":%g,"h":%g,"built":%d,"indoor":%d,"fixed":%d,"src":"matlab"}]}', ...
                     strrep(P.name{i}, '"', ''''), la, lo, lv, t.f, P.h(i), P.built(i), P.indoor(i), P.sensor(i));
      wx_send(full, body);
      fprintf('  %-28s %6.1f dBuV/m\n', P.name{i}, lv);
      pause(period);
    end
  end
end

function wx_send(url, body)
  try
    if exist('OCTAVE_VERSION', 'builtin'), error('use curl'); end
    webwrite(url, body, weboptions('MediaType', 'application/json', 'Timeout', 15));
  catch
    f = [tempname '.json']; fid = fopen(f, 'w'); fwrite(fid, body); fclose(fid);
    [st, msg] = system(sprintf('curl -s -X POST -H "Content-Type: application/json" --data-binary @"%s" "%s"', f, url));
    delete(f); if st ~= 0, warning('Sending failed: %s', msg); end
  end
end
