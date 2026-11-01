// Never cache admin HTML, API responses, or credentials.
self.addEventListener('install',()=>{});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(event.request.mode!=='navigate')return;
  const url=new URL(event.request.url);
  if(!url.pathname.startsWith('/secure/admin'))return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>new Response('<h1>You are offline</h1><p>Reconnect to manage your store.</p>',{headers:{'Content-Type':'text/html'}})));
});
