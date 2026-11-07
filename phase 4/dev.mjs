// Starts the API (port 3001) and the web app (port 3000) together.
// Written in plain Node so it works the same on Windows, macOS and Linux.
import { spawn } from 'node:child_process';

const children = [
  spawn('npm', ['run', 'dev', '-w', 'apps/api'], { stdio: 'inherit', shell: true }),
  spawn('npm', ['run', 'dev', '-w', 'apps/web'], { stdio: 'inherit', shell: true }),
];

const stopAll = () => {
  for (const child of children) {
    child.kill();
  }
};

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
for (const child of children) {
  child.on('exit', (code) => {
    if (code) {
      stopAll();
      process.exit(code);
    }
  });
}
