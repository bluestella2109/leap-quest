/** LEAP QUEST Apps Script API v2
 * Deploy as Web app: Execute as Me, access Anyone.
 * Sheets used: ユーザー / ランキング / スコア履歴
 */
const LQ_SHEET_USERS = 'ユーザー';
const LQ_SHEET_RANKING = 'ランキング';
const LQ_SHEET_HISTORY = 'スコア履歴';
function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = String(p.callback || '');
  let result;
  try { result = handleRequest_(p); }
  catch (err) { result = { ok: false, error: safeError_(err) }; }
  const json = JSON.stringify(result);
  if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json.replace(/</g, '\\u003c') + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
function handleRequest_(p) {
  const action = String(p.action || 'ping');
  if (action === 'ping') return { ok: true, version: '2.0', time: new Date().toISOString() };
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheets_(ss);
    if (action === 'register') return register_(ss, p);
    if (action === 'login') return login_(ss, p);
    if (action === 'getRanking' || action === 'refreshRanking') return getRanking_(ss, Number(p.limit || 100));
    if (action === 'submitScore') return submitScore_(ss, p);
    throw new Error('未対応の操作です: ' + action);
  } finally { lock.releaseLock(); }
}
function ensureSheets_(ss) {
  let users = ss.getSheetByName(LQ_SHEET_USERS);
  if (!users) { users = ss.insertSheet(LQ_SHEET_USERS); users.appendRow(['ユーザーID','PINハッシュ','作成日時','レベル','経験値','累計スコア','最終ログイン','冒険者名']); }
  if (users.getLastColumn() < 8) { users.getRange(1,8).setValue('冒険者名'); }
  let ranking = ss.getSheetByName(LQ_SHEET_RANKING);
  if (!ranking) { ranking = ss.insertSheet(LQ_SHEET_RANKING); ranking.appendRow(['順位','ユーザーID','レベル','経験値','スコア','更新日時','冒険者名']); }
  if (ranking.getLastColumn() < 7) ranking.getRange(1,7).setValue('冒険者名');
  let history = ss.getSheetByName(LQ_SHEET_HISTORY);
  if (!history) { history = ss.insertSheet(LQ_SHEET_HISTORY); history.appendRow(['日時','ユーザーID','モード','今回スコア','累計スコア']); }
}
function register_(ss,p) {
  const pin=validPin_(p.pin), displayName=validDisplayName_(p.displayName), sh=ss.getSheetByName(LQ_SHEET_USERS), values=sh.getDataRange().getValues();
  let id='';
  if(String(p.userId||'').trim()) { id=validId_(p.userId); if(values.slice(1).some(r=>String(r[0])===id)) throw new Error('このユーザーIDはすでに登録されています。'); }
  else { for(let attempt=0;attempt<30;attempt++){ const candidate=String(Math.floor(100000+Math.random()*900000)); if(!values.slice(1).some(r=>String(r[0])===candidate)){id=candidate;break;} } if(!id) throw new Error('IDを発行できませんでした。もう一度お試しください。'); }
  sh.appendRow([id,hashPin_(id,pin),new Date(),1,0,0,new Date(),displayName]); updateRanking_(ss);
  return {ok:true,profile:{userId:id,displayName:displayName,level:1,exp:0,score:0}};
}
function login_(ss,p) {
  const id=validId_(p.userId), pin=validPin_(p.pin), sh=ss.getSheetByName(LQ_SHEET_USERS), values=sh.getDataRange().getValues();
  for(let i=1;i<values.length;i++){const r=values[i];if(String(r[0])===id){if(String(r[1])!==hashPin_(id,pin))throw new Error('ユーザーIDまたはPINが違います。');sh.getRange(i+1,7).setValue(new Date());return {ok:true,profile:{userId:id,level:Number(r[3])||1,exp:Number(r[4])||0,score:Number(r[5])||0,displayName:String(r[7]||'冒険者')}};}}
  throw new Error('ユーザーIDが見つかりません。');
}
function submitScore_(ss,p) {
  const id=validId_(p.userId), score=Math.max(0,Math.floor(Number(p.score)||0)), users=ss.getSheetByName(LQ_SHEET_USERS), values=users.getDataRange().getValues();
  for(let i=1;i<values.length;i++){if(String(values[i][0])===id){const old=Number(values[i][5])||0, exp=Math.max(Number(values[i][4])||0,Number(p.exp)||0), level=Math.max(Number(values[i][3])||1,Number(p.level)||1), total=old+score;users.getRange(i+1,4,1,4).setValues([[level,exp,total,new Date()]]);ss.getSheetByName(LQ_SHEET_HISTORY).appendRow([new Date(),id,String(p.mode||''),score,total]);updateRanking_(ss);return {ok:true,totalScore:total};}}
  throw new Error('ユーザーが見つかりません。再度ログインしてください。');
}
function updateRanking_(ss) {
  const users=ss.getSheetByName(LQ_SHEET_USERS), ranking=ss.getSheetByName(LQ_SHEET_RANKING), rows=users.getDataRange().getValues().slice(1).filter(r=>r[0]).map(r=>({userId:String(r[0]),displayName:String(r[7]||'冒険者'),level:Number(r[3])||1,exp:Number(r[4])||0,score:Number(r[5])||0}));
  rows.sort((a,b)=>b.score-a.score||b.exp-a.exp||a.userId.localeCompare(b.userId));
  if(ranking.getLastRow()>1)ranking.getRange(2,1,ranking.getLastRow()-1,7).clearContent();
  if(rows.length)ranking.getRange(2,1,rows.length,7).setValues(rows.map((r,i)=>[i+1,r.userId,r.level,r.exp,r.score,new Date(),r.displayName]));
}
function getRanking_(ss,limit) {
  // The dedicated ランキング tab is the source of truth for leaderboard display.
  const sh=ss.getSheetByName(LQ_SHEET_RANKING), rows=sh.getDataRange().getValues().slice(1).filter(r=>r[1]);
  return {ok:true,ranking:rows.slice(0,Math.min(Math.max(limit,1),100)).map(r=>({rank:Number(r[0]),userId:String(r[1]),level:Number(r[2])||1,exp:Number(r[3])||0,score:Number(r[4])||0,displayName:String(r[6]||'冒険者')}))};
}
function validId_(v){const s=String(v||'').trim();if(!/^\d{6}$/.test(s))throw new Error('ユーザーIDは6桁の数字で入力してください。');return s;}
function validPin_(v){const s=String(v||'').trim();if(!/^\d{4}$/.test(s))throw new Error('PINは4桁の数字で入力してください。');return s;}
function hashPin_(id,pin){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,id+':'+pin,Utilities.Charset.UTF_8);return bytes.map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function safeError_(err){return err&&err.message?String(err.message):String(err||'不明なエラーが発生しました。');}

function validDisplayName_(v){const s=String(v||'').trim();if(!s||s.length>20)throw new Error('冒険者名は1〜20文字で入力してください。');return s.replace(/[\r\n\t]/g,' ');}
