import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();
const subject = process.env.VAPID_SUBJECT || 'mailto:contato@dottasupermercados.com.br';

console.log('====================================================');
console.log('Par de Chaves VAPID Gerado com Sucesso (web-push)');
console.log('====================================================\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=${subject}\n`);
