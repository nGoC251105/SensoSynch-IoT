// Keep the JWT only in memory; never persist passwords or tokens in browser storage.
const authSession = {
 token:null, expiresAt:0, pending:null,
 clear(){this.token=null;this.expiresAt=0;},
 ensure(){
  if(this.token&&Date.now()<this.expiresAt-5000)return Promise.resolve();
  if(this.pending)return this.pending;
  this.pending=new Promise(resolve=>{
   const dialog=document.createElement('dialog');
   dialog.className='auth-dialog';
   dialog.setAttribute('aria-labelledby','authTitle');
   dialog.innerHTML=`<form><h2 id="authTitle">Đăng nhập SensoSynch</h2>
    <label>Tên đăng nhập<input name="username" autocomplete="username" maxlength="128" required></label>
    <label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required></label>
    <p class="auth-error" role="alert"></p><button class="primary" type="submit">Đăng nhập</button></form>`;
   dialog.addEventListener('cancel',event=>event.preventDefault());
   const form=dialog.querySelector('form');
   form.onsubmit=async event=>{
    event.preventDefault();
    const button=form.querySelector('button'),error=form.querySelector('.auth-error');
    button.disabled=true;error.textContent='';
    try{
     const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:form.elements.username.value,password:form.elements.password.value})});
     const result=await response.json();
     if(!response.ok)throw new Error(response.status===429?'Thử lại sau do đăng nhập quá nhiều lần.':'Tên đăng nhập hoặc mật khẩu không đúng.');
     this.token=result.access_token;this.expiresAt=Date.now()+result.expires_in*1000;
     form.elements.password.value='';dialog.close();dialog.remove();resolve();
    }catch(e){error.textContent=e.message;}
    finally{button.disabled=false;}
   };
   document.body.append(dialog);dialog.showModal();
  }).finally(()=>{this.pending=null;});
  return this.pending;
 }
};
