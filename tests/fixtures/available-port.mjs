import net from 'node:net';
// Let the OS select a bindable fixture port instead of assuming a fixed port
// in Windows' dynamic client-port range is available.
export async function availablePort(){
 const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const port=server.address().port;await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));return port;
}
