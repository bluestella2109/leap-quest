(() => {
  let sequence=0;
  function url(){return localStorage.getItem('leap-quest-api-url')||window.LEAP_CONFIG?.apiUrl||''}
  function call(action,payload={}){const base=url();if(!base)return Promise.reject(new Error('Apps Script URLが未設定です。設定画面でURLを登録してください。'));
    return new Promise((resolve,reject)=>{const cb='lq_cb_'+Date.now()+'_'+(++sequence);const script=document.createElement('script');let done=false;const cleanup=()=>{if(done)return;done=true;clearTimeout(timer);delete window[cb];script.remove()};const timer=setTimeout(()=>{cleanup();reject(new Error('サーバー応答がタイムアウトしました。URLとデプロイ設定を確認してください。'))},12000);window[cb]=(data)=>{cleanup();if(data&&data.ok===false)reject(new Error(data.error||'サーバーエラー'));else resolve(data)};const params=new URLSearchParams({action,callback:cb,...Object.fromEntries(Object.entries(payload).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):String(v)]))});script.onerror=()=>{cleanup();reject(new Error('Apps Scriptに接続できませんでした。ウェブアプリURLを確認してください。'))};script.src=base+(base.includes('?')?'&':'?')+params.toString();document.head.appendChild(script)});
  }
  window.LQApi={url,call,saveUrl(v){localStorage.setItem('leap-quest-api-url',v.trim())}};
})();
