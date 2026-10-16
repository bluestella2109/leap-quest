/** LEAP QUEST spreadsheet backend. Deploy as a Web App, execute as you, access: Anyone. */
const APP_TITLE = 'LEAP QUEST';
const TAB_USERS = 'Users', TAB_SESSIONS = 'Sessions', TAB_RESERVED = 'ReservedIds';
const SESSION_HOURS = 72;
function doGet(e) {
  const p = e && e.parameter || {}, callback = String(p.callback || '');
  let result;
  try {
    const action = String(p.action || '');
    const data = p.payload ? JSON.parse(p.payload) : {};
    result = handle_(action, data);
  } catch (err) { result = { ok:false, error: safeError_(err) }; }
  const body = callback && /^[A-Za-z_$][\w$]*$/.test(callback) ? callback + '(' + JSON.stringify(result).replace(/</g,'\\u003c') + ');' : JSON.stringify(result);
  return ContentService.createTextOutput(body).setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
function handle_(action, d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); ensureSheets_(ss);
  if (action === 'reserveId') {
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try { for (let i=0;i<50;i++) { const id=String(Math.floor(100000+Math.random()*900000)); if (!findRow_(sheet_(ss,TAB_USERS),1,id) && !findRow_(sheet_(ss,TAB_RESERVED),1,id)) { sheet_(ss,TAB_RESERVED).appendRow([id,new Date()]); return {ok:true,userId:id}; } } throw new Error('IDの発行に失敗しました。もう一度お試しください。'); }
    finally { lock.releaseLock(); }
  }
  if (action === 'register') {
    const id=digits_(d.userId,6), name=text_(d.displayName,20), hash=hash_(d.pinHash);
    if (!name || !hash) throw new Error('名前とPINを確認してください。');
    const lock=LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const us=sheet_(ss,TAB_USERS); if (findRow_(us,1,id)) throw new Error('このIDは使用済みです。もう一度登録してください。');
      if (!findRow_(sheet_(ss,TAB_RESERVED),1,id)) throw new Error('登録セッションが無効です。もう一度登録してください。');
      const now=new Date(); const row=[id,name,hash,'',0,1,'[]','[]',0,0,0,0,'',now,now]; us.appendRow(row);
      deleteByValue_(sheet_(ss,TAB_RESERVED),1,id); const user={userId:id,displayName:name,pinHash:hash,photoURL:'',exp:0,level:1,mastered:[],review:[],masteredCount:0,answered:0,correct:0,accuracy:0,lastLog:'',online:true};
      return createSession_(ss,user);
    } finally { lock.releaseLock(); }
  }
  if (action === 'login') {
    const id=digits_(d.userId,6), hash=hash_(d.pinHash); const cache=CacheService.getScriptCache(), failKey='pin-fail-'+id; if(Number(cache.get(failKey)||0)>=5)throw new Error('ログイン試行が多すぎます。15分ほど待ってから再試行してください。'); const us=sheet_(ss,TAB_USERS), r=findRow_(us,1,id);
    if (!r) { cache.put(failKey,String(Number(cache.get(failKey)||0)+1),900); throw new Error('ユーザーIDまたはPINが違います。'); }
    const row=us.getRange(r,1,1,15).getValues()[0]; if (String(row[2])!==hash) { cache.put(failKey,String(Number(cache.get(failKey)||0)+1),900); throw new Error('ユーザーIDまたはPINが違います。'); } cache.remove(failKey);
    row[13]=row[13]||new Date(); row[14]=new Date(); us.getRange(r,1,1,15).setValues([row]); return createSession_(ss,rowToUser_(row));
  }
  if (action === 'me') { const u=auth_(ss,d.token); return {ok:true,userId:u.userId,token:d.token,profile:publicUser_(u)}; }
  if (action === 'logout') { deleteByValue_(sheet_(ss,TAB_SESSIONS),2,String(d.token||'')); return {ok:true}; }
  if (action === 'leaderboard') return leaderboard_(ss, d.limit);
  const u=auth_(ss,d.token);
  if (action === 'updateProfile') {
    const us=sheet_(ss,TAB_USERS),r=findRow_(us,1,u.userId), row=us.getRange(r,1,1,15).getValues()[0];
    if (d.displayName!==undefined) row[1]=text_(d.displayName,20)||row[1];
    if (d.photoURL!==undefined) { const photo=String(d.photoURL||''); if (photo.length>260000) throw new Error('画像が大きすぎます。200KB以下にしてください。'); if (photo && !/^data:image\/(png|jpeg|webp|gif);base64,/.test(photo)) throw new Error('画像形式が正しくありません。'); row[3]=photo; }
    row[14]=new Date(); us.getRange(r,1,1,15).setValues([row]); return {ok:true,profile:publicUser_(rowToUser_(row))};
  }
  if (action === 'saveProgress') {
    const us=sheet_(ss,TAB_USERS),r=findRow_(us,1,u.userId),row=us.getRange(r,1,1,15).getValues()[0];
    row[4]=num_(d.exp,0,100000000); row[5]=Math.max(1,num_(d.level,1,1000000)); row[8]=num_(d.masteredCount,0,2300); row[9]=num_(d.answered,0,100000000); row[10]=num_(d.correct,0,row[9]); row[11]=row[9]?Math.round(row[10]/row[9]*100):0; row[12]=text_(d.lastLog,300); row[14]=new Date(); us.getRange(r,1,1,15).setValues([row]); return {ok:true,profile:publicUser_(rowToUser_(row))};
  }
  throw new Error('未対応の操作です。');
}
function ensureSheets_(ss){const specs=[[TAB_USERS,['userId','displayName','pinHash','photoURL','exp','level','masteredJSON','reviewJSON','masteredCount','answered','correct','accuracy','lastLog','createdAt','updatedAt']],[TAB_SESSIONS,['userId','token','expiresAt']],[TAB_RESERVED,['userId','createdAt']]];specs.forEach(([name,headers])=>{let s=ss.getSheetByName(name);if(!s)s=ss.insertSheet(name);if(s.getLastRow()===0)s.appendRow(headers);s.setFrozenRows(1)});}
function sheet_(ss,n){return ss.getSheetByName(n)}
function findRow_(s,col,val){if(s.getLastRow()<2)return 0;const f=s.getRange(2,col,s.getLastRow()-1,1).createTextFinder(String(val)).matchEntireCell(true).findNext();return f?f.getRow():0}
function deleteByValue_(s,col,val){const r=findRow_(s,col,val);if(r)s.deleteRow(r)}
function digits_(v,n){const s=String(v||'');if(!(new RegExp('^\\d{'+n+'}$')).test(s))throw new Error('入力内容を確認してください。');return s}
function text_(v,max){return String(v||'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,max)}
function hash_(v){const s=String(v||'');if(!/^[a-f0-9]{64}$/i.test(s))throw new Error('認証情報が正しくありません。');return s.toLowerCase()}
function num_(v,min,max){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):min}
function intArray_(v){return Array.isArray(v)?[...new Set(v.map(Number).filter(n=>Number.isInteger(n)&&n>0&&n<=2300))].slice(0,2300):[]}
function rowToUser_(r){return {userId:String(r[0]),displayName:String(r[1]||'冒険者'),pinHash:String(r[2]),photoURL:String(r[3]||''),exp:Number(r[4])||0,level:Number(r[5])||1,mastered:parseJSON_(r[6]),review:parseJSON_(r[7]),masteredCount:Number(r[8])||0,answered:Number(r[9])||0,correct:Number(r[10])||0,accuracy:Number(r[11])||0,lastLog:String(r[12]||''),createdAt:r[13],updatedAt:r[14],online:false}}
function parseJSON_(v){try{return JSON.parse(v||'[]')}catch(_){return []}}
function publicUser_(u){return {userId:u.userId,displayName:u.displayName,photoURL:u.photoURL,exp:u.exp,level:u.level,mastered:u.mastered,review:u.review,masteredCount:u.masteredCount,answered:u.answered,correct:u.correct,accuracy:u.accuracy,lastLog:u.lastLog,online:false}}
function createSession_(ss,u){const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');const s=sheet_(ss,TAB_SESSIONS);s.appendRow([u.userId,token,new Date(Date.now()+SESSION_HOURS*3600000)]);return {ok:true,userId:u.userId,token,profile:publicUser_(u)}}
function auth_(ss,token){if(!token)throw new Error('ログインしてください。');const s=sheet_(ss,TAB_SESSIONS);if(s.getLastRow()<2)throw new Error('セッションが無効です。ログインし直してください。');const rows=s.getRange(2,1,s.getLastRow()-1,3).getValues();for(let i=rows.length-1;i>=0;i--){if(String(rows[i][1])===String(token)){if(new Date(rows[i][2]).getTime()<Date.now()){s.deleteRow(i+2);throw new Error('ログイン期限が切れました。ログインし直してください。')}const r=findRow_(sheet_(ss,TAB_USERS),1,String(rows[i][0]));if(!r)break;return rowToUser_(sheet_(ss,TAB_USERS).getRange(r,1,1,15).getValues()[0]);}}throw new Error('セッションが無効です。ログインし直してください。')}
function leaderboard_(ss, limit) {
  const s=sheet_(ss,TAB_USERS);
  if(s.getLastRow()<2) return {ok:true,ranking:[]};
  const rows=s.getRange(2,1,s.getLastRow()-1,15).getValues();
  const ranking=rows.filter(r=>String(r[0]||'').match(/^\d{6}$/)).map(r=>({userId:String(r[0]),displayName:String(r[1]||'冒険者'),exp:Number(r[4])||0,level:Number(r[5])||1,masteredCount:Number(r[8])||0,accuracy:Number(r[11])||0})).sort((a,b)=>b.exp-a.exp||b.masteredCount-a.masteredCount||b.accuracy-a.accuracy).slice(0,Math.max(1,Math.min(100,num_(limit,1,100))));
  return {ok:true,ranking};
}
