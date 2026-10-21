import webpush from 'web-push';
const keys = webpush.generateVAPIDKeys();
console.log('将以下变量加入部署环境（不要公开 VAPID_PRIVATE_KEY）：\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:your-real-admin-email@example.com');
