%% WISDOM sensor emulator (software-in-the-loop)
% Streams emulated field-strength readings to the WISDOM Digital Shadow
% (groundwave-lab.pages.dev, Digital shadow tab -> Live link).
%
% It plays the part of the future SDR sensor stations: same data format,
% same interface. Swap this script for the real sensors later and the
% website does not change.
%
% "Reality" here comes from an INDEPENDENT model (log-distance path loss,
% building and indoor loss, log-normal shadowing, fading, receiver bias,
% drift, quantisation and dropouts). It is deliberately not the ITU-R
% P.1812 model the website uses, so calibration results are not circular.
% The injected values are printed at the end so you can check whether the
% website's calibration recovers them.
%
% Sensor positions: either your own exact coordinates (P_TABLE below, e.g.
% from Google Maps for a campus), or an automatic layout around the tower.
% If SYNC_TX is true and you drag the tower on the website while connected,
% the emulator follows it: the sensors stay where they are and their
% readings change with the new geometry.
%
% Requires MATLAB R2016b or newer (jsonencode, webwrite). If MATLAB's
% certificates are too old (e.g. R2017a) it switches to Windows curl.
% Usage: set CHANNEL to the name shown in the Live link panel, press
% Connect there, then type  wisdom_sensor_emulator  in MATLAB.

clear; clc;

%% ---- link ----
URL      = 'https://groundwave-lab.pages.dev/api/measure';
CHANNEL  = 'wisdom-lab1';    % must match the Live link panel
KEY      = '';               % only if the site has a MEASURE_KEY secret
PERIOD   = 3;                % seconds between uploads
DURATION = 300;              % total run time in seconds
SRC      = 'matlab';         % shown on the website as "emulated . matlab"
USE_CURL = false;            % true = send with Windows curl. Switches on by itself if
                             % MATLAB's built-in certificates are too old (e.g. R2017a)
SYNC_TX  = true;             % follow the tower when it is moved on the website

%% ---- transmitter the shadow will model (set it to your site) ----
TX.name   = 'Campus FM test';
TX.lat    = 6.7951;          % degrees
TX.lon    = 79.9009;         % degrees
TX.h      = 60;              % antenna height above ground, m
TX.f_mhz  = 100;             % frequency, MHz
TX.erp_kw = 10;              % effective radiated power, kW

%% ---- sensor positions ----
% Your own points (one row each), e.g. copied from Google Maps:
%   lat, lon, antenna height (m), behind buildings (1/0), indoor (1/0), fixed sensor (1/0)
% Leave P_TABLE empty ([]) to use the automatic layout around the tower.
P_TABLE = [];
% Example for a campus (replace with real coordinates):
% P_TABLE = [ 6.88400 79.88600 15  0 0 1    % S1 rooftop
%             6.88320 79.88510 10  1 0 1    % S2 between buildings
%             6.88290 79.88660 1.2 0 1 1    % S3 indoor, ground floor
%             6.88450 79.88700 1.5 0 0 0    % walk point
%             6.88480 79.88760 1.5 1 0 0    % walk point behind a building
%             6.88510 79.88820 1.5 0 0 0 ]; % walk point

%% ---- emulated "reality" (independent of the website model) ----
N_EXP  = 2.9;    % log-distance path-loss exponent
BLD_DB = 10;     % extra loss for receivers behind buildings, dB
IND_DB = 12;     % extra loss indoors, dB
SIGMA  = 6;      % location variability (log-normal shadowing), dB
FADE   = 1.0;    % short-term fading per reading, dB rms
BIAS   = 1.5;    % receiver calibration bias, dB
DRIFT  = 0.5;    % receiver drift, dB per hour
QSTEP  = 0.5;    % quantisation step of an 8-bit SDR, dB
DROP   = 0.05;   % probability that a reading is lost
rng(7);          % repeatable runs

%% ---- build the sensor list ----
R = 6371;
dest = @(lat,lon,dkm,brg) [ ...
  asind(sind(lat).*cosd(dkm/R*180/pi) + cosd(lat).*sind(dkm/R*180/pi).*cosd(brg)), ...
  lon + atan2d(sind(brg).*sind(dkm/R*180/pi).*cosd(lat), cosd(dkm/R*180/pi) - sind(lat).*sind(asind(sind(lat).*cosd(dkm/R*180/pi) + cosd(lat).*sind(dkm/R*180/pi).*cosd(brg)))) ];
distkm = @(la1,lo1,la2,lo2) 2*R*asind(sqrt(sind((la2-la1)/2).^2 + cosd(la1).*cosd(la2).*sind((lo2-lo1)/2).^2))*pi/180;

if ~isempty(P_TABLE)
  n = size(P_TABLE,1);
  lat = P_TABLE(:,1)'; lon = P_TABLE(:,2)'; h = P_TABLE(:,3)';
  built = P_TABLE(:,4)'; indoor = P_TABLE(:,5)'; fixed = P_TABLE(:,6)';
  id = cell(1,n); ns = 0; nw = 0;
  for k = 1:n
    if fixed(k), ns = ns+1; id{k} = sprintf('S%d', ns); else, nw = nw+1; id{k} = sprintf('W%02d', nw); end
  end
else
  id = {}; d0 = []; b0 = []; h = []; built = []; indoor = []; fixed = [];
  id{end+1}='S1-rooftop';  d0(end+1)=2.6; b0(end+1)=72;  h(end+1)=15;  built(end+1)=0; indoor(end+1)=0; fixed(end+1)=1;
  id{end+1}='S2-shadowed'; d0(end+1)=5.4; b0(end+1)=104; h(end+1)=10;  built(end+1)=1; indoor(end+1)=0; fixed(end+1)=1;
  id{end+1}='S3-indoor';   d0(end+1)=8.8; b0(end+1)=48;  h(end+1)=1.2; built(end+1)=0; indoor(end+1)=1; fixed(end+1)=1;
  for k = 1:20
    id{end+1}=sprintf('W%02d-walk',k); d0(end+1)=1.0+0.55*k; b0(end+1)=85+18*sin(0.9*k);
    h(end+1)=1.5; built(end+1)=rand<0.4; indoor(end+1)=0; fixed(end+1)=0;
  end
  n = numel(id); lat = zeros(1,n); lon = zeros(1,n);
  for k = 1:n, p = dest(TX.lat,TX.lon,d0(k),b0(k)); lat(k)=p(1); lon(k)=p(2); end
end
shadow = SIGMA*randn(1,n);            % fixed per location (it does not move with the tower)
fixedIdx = find(fixed); walkIdx = find(~fixed);

%% ---- send loop ----
url  = sprintf('%s?ch=%s', URL, CHANNEL);
hdr  = {};
if ~isempty(KEY), hdr = {'Authorization', ['Bearer ' KEY]}; end
opts = weboptions('MediaType','application/json','Timeout',15,'HeaderFields',hdr);
logf = fopen('wisdom_emulated_log.csv','w');      % backup for the CSV upload
fprintf(logf,'lat,lon,level,built,height,indoor,fixed\n');

fprintf('Streaming to %s for %d s. Press Ctrl+C to stop.\n', url, DURATION);
t0 = tic; walkShown = 0; sent = 0; first = true;
while toc(t0) < DURATION
  % follow the tower if it was moved on the website
  if SYNC_TX && ~first
    try
      srv = getJson([url '&since=9000000000000&after=999999999999'], opts, KEY, USE_CURL);   % station only, no readings
      if isfield(srv,'tx') && isstruct(srv.tx) && isfield(srv.tx,'lat') && ...
         (abs(srv.tx.lat-TX.lat) > 1e-6 || abs(srv.tx.lon-TX.lon) > 1e-6 || (isfield(srv.tx,'h') && abs(srv.tx.h-TX.h) > 0.01))
        TX.lat = srv.tx.lat; TX.lon = srv.tx.lon;
        if isfield(srv.tx,'h'), TX.h = srv.tx.h; end
        fprintf('Tower moved on the website: now at %.5f, %.5f (mast %g m).\n', TX.lat, TX.lon, TX.h);
      end
    catch
      % keep the current tower
    end
  end
  dkm = distkm(TX.lat, TX.lon, lat, lon);
  E0  = 106.9 + 10*log10(TX.erp_kw);  % dBuV/m at 1 km for the ERP
  tH  = toc(t0)/3600;
  walkShown = min(numel(walkIdx), walkShown + 1);   % the walker reaches one new point per cycle
  show = [fixedIdx, walkIdx(1:walkShown)];
  rd = struct('t',{},'sensor',{},'lat',{},'lon',{},'f_mhz',{},'level',{},'h',{},'built',{},'indoor',{},'fixed',{},'src',{});
  for k = show
    if rand < DROP, continue; end                  % lost reading
    lv = E0 - 10*N_EXP*log10(max(dkm(k),0.05)) - BLD_DB*built(k) - IND_DB*indoor(k) ...
         + shadow(k) + FADE*randn + BIAS + DRIFT*tH;
    lv = round(lv/QSTEP)*QSTEP;
    rd(end+1) = struct('t', char(datetime('now','TimeZone','UTC','Format','yyyy-MM-dd''T''HH:mm:ss''Z''')), ...
      'sensor', id{k}, 'lat', lat(k), 'lon', lon(k), 'f_mhz', TX.f_mhz, 'level', lv, ...
      'h', h(k), 'built', logical(built(k)), 'indoor', logical(indoor(k)), 'fixed', logical(fixed(k)), 'src', SRC); %#ok<SAGROW>
    fprintf(logf,'%.6f,%.6f,%.1f,%d,%.1f,%d,%d\n', lat(k), lon(k), lv, built(k), h(k), indoor(k), fixed(k));
  end
  if first, body = struct('tx', TX, 'readings', rd); else, body = struct('readings', rd); end
  try
    res = sendJson(url, jsonencode(body), opts, KEY, USE_CURL);
    sent = sent + numel(rd); first = false;
    fprintf('%5.0f s  sent %2d readings  (total stored %d)\n', toc(t0), numel(rd), res.total);
  catch err
    if ~USE_CURL && (~isempty(strfind(err.message,'certificate')) || ~isempty(strfind(err.message,'SSL')) || ~isempty(strfind(err.message,'secure connection')))
      USE_CURL = true;          % old MATLAB certificate store: use Windows curl instead
      fprintf('MATLAB''s certificates are out of date; switching to curl.\n');
      try
        res = sendJson(url, jsonencode(body), opts, KEY, USE_CURL);
        sent = sent + numel(rd); first = false;
        fprintf('%5.0f s  sent %2d readings  (total stored %d)\n', toc(t0), numel(rd), res.total);
      catch err2
        fprintf(2,'Upload failed (curl): %s\n', err2.message);
      end
    else
      fprintf(2,'Upload failed: %s\n', err.message);
    end
  end
  pause(PERIOD);
end
fclose(logf);

%% ---- what the website's calibration should recover ----
fprintf('\nDone: %d readings sent.\n', sent);
fprintf('Injected: behind-building loss %g dB, indoor loss %g dB, receiver bias %+g dB, path-loss exponent %g (slope %g dB per decade), shadowing %g dB.\n', ...
        BLD_DB, IND_DB, BIAS, N_EXP, -10*N_EXP, SIGMA);
fprintf('Note: with real buildings switched on, the website already predicts part of the building loss,\n');
fprintf('so "What the model learned" shows the EXTRA loss beyond its building model.\n');
fprintf('A backup of every reading is in wisdom_emulated_log.csv (use Upload CSV if the live link is down).\n');

%% ---- helpers: send / read JSON with MATLAB's webwrite/webread or with curl ----
function res = sendJson(url, body, opts, key, useCurl)
  if ~useCurl
    res = webwrite(url, body, opts);
    return
  end
  f = [tempname '.json'];
  fid = fopen(f, 'w'); fwrite(fid, body, 'char'); fclose(fid);
  hdr = '';
  if ~isempty(key), hdr = sprintf(' -H "Authorization: Bearer %s"', key); end
  cmd = sprintf('curl -s -S -X POST -H "Content-Type: application/json"%s --data-binary "@%s" "%s"', hdr, f, url);
  [status, out] = system(cmd);
  delete(f);
  if status ~= 0
    error('curl failed (%d): %s', status, strtrim(out));
  end
  res = jsondecode(out);
  if isfield(res, 'error')
    error('server: %s', res.error);
  end
end

function res = getJson(url, opts, key, useCurl)
  if ~useCurl
    res = webread(url, opts);
    return
  end
  hdr = '';
  if ~isempty(key), hdr = sprintf(' -H "Authorization: Bearer %s"', key); end
  [status, out] = system(sprintf('curl -s -S%s "%s"', hdr, url));
  if status ~= 0
    error('curl failed (%d): %s', status, strtrim(out));
  end
  res = jsondecode(out);
end
