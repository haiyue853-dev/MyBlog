import {createInterface} from 'node:readline/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {Store} from '../src/lib/store';
import {hashPassword} from '../src/lib/security';
import {MIN_PASSWORD_LENGTH} from '../src/lib/types';

if(existsSync('.env.local'))process.loadEnvFile('.env.local');
if(!process.stdin.isTTY){console.error('请在交互式终端运行 npm run setup-owner。');process.exit(1);}
const store=new Store(process.env.DATA_DIR||join(process.cwd(),'data'));
const rl=createInterface({input:process.stdin,output:process.stdout});
try{
  if(store.getOwner()){const confirm=await rl.question('已有站主账号。重设密码会退出所有设备，输入 RESET 继续：');if(confirm!=='RESET'){console.log('已取消。');process.exitCode=0;store.close();rl.close();process.exit(0);}}
  const name=(await rl.question('站主昵称（回车使用“小屋站主”）：')).trim()||'小屋站主';rl.close();
  async function secret(prompt:string){process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();return new Promise<string>((resolve,reject)=>{let value='';function onData(chunk:Buffer){for(const char of chunk.toString()){if(char==='\u0003'){cleanup();reject(new Error('已取消。'));return;}if(char==='\r'||char==='\n'){cleanup();resolve(value);return;}if(char==='\u007f'||char==='\b'){if(value){value=value.slice(0,-1);process.stdout.write('\b \b');}}else if(char.charCodeAt(0)>=32&&value.length<256){value+=char;process.stdout.write('*');}}}function cleanup(){process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('data',onData);});}
  const password=await secret(`设置站主密码（至少 ${MIN_PASSWORD_LENGTH} 位）：`);if(password.length<MIN_PASSWORD_LENGTH)throw new Error(`密码需要至少 ${MIN_PASSWORD_LENGTH} 位。`);const repeat=await secret('再次输入密码：');if(password!==repeat)throw new Error('两次密码不一致，账号未修改。');
  store.setOwner(name.slice(0,50),hashPassword(password));console.log('站主账号已准备好。打开网站，点击右上角的锁图标登录。');
}catch(error){console.error(error instanceof Error?error.message:'初始化失败。');process.exitCode=1;}finally{rl.close();store.close();}
