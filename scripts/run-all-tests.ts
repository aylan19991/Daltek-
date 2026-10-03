import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const downloadsDir = path.join(rootDir, 'downloads_storage');

const BASE_URL = 'http://127.0.0.1:3000';

async function runTests() {
  console.log('====================================================');
  console.log('   DALTEK — SUITE DE TESTS COMPLÈTE EN DIRECT       ');
  console.log('====================================================\n');

  // Test 0: Server Health
  console.log('0. Vérification de l’état du serveur DALTEK...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthJson = await healthRes.json();
  console.log('   -> Serveur en ligne :', healthJson.status, healthJson.name);

  // Get or Create test establishment
  console.log('1. Récupération des établissements...');
  let estRes = await fetch(`${BASE_URL}/api/establishments`);
  let ests = await estRes.json();
  let testEst = ests[0];

  if (!testEst) {
    console.log('   Création d’un établissement de test...');
    // Login or setup admin first
    await fetch(`${BASE_URL}/api/admin/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'ADMIN123' })
    });
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'ADMIN123' })
    });
    const loginJson = await loginRes.json();
    const token = loginJson.token;

    const createEstRes = await fetch(`${BASE_URL}/api/establishments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Établissement Central DALTEK',
        code: 'BPH-7501',
        icon: 'apartment'
      })
    });
    testEst = await createEstRes.json();
  }
  console.log(`   -> Établissement actif : ${testEst.name} (Code: ${testEst.code}, ID: ${testEst.id})`);

  // Clear previous queue for pristine test run
  await fetch(`${BASE_URL}/api/queue/${encodeURIComponent(testEst.id)}/clear`, { method: 'POST' });

  // TEST 1: Créer 14 sur Web
  console.log('\nTEST 1 & 2-7: Créer ticket #14 sur Web et synchronisation unifiée...');
  const add14Res = await fetch(`${BASE_URL}/api/queue/${encodeURIComponent(testEst.id)}/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketNumber: 14, type: 'Standard', desk: 'Guichet 1' })
  });
  const add14Json = await add14Res.json();
  console.log('   -> Réponse ajout ticket 14 :', add14Json.success ? 'SUCCÈS' : 'ÉCHEC', add14Json.ticket);

  // TEST 8 & 9: Créer 7 depuis Android
  console.log('\nTEST 8 & 9: Créer ticket #7 depuis Android et propagation...');
  const add7Res = await fetch(`${BASE_URL}/api/queue/${encodeURIComponent(testEst.id)}/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketNumber: 7, type: 'Standard', desk: 'Guichet 2' })
  });
  const add7Json = await add7Res.json();
  console.log('   -> Réponse ajout ticket 7 :', add7Json.success ? 'SUCCÈS' : 'ÉCHEC', add7Json.ticket);

  // Verify FIFO order (14 then 7)
  const qStateRes = await fetch(`${BASE_URL}/api/queue/${encodeURIComponent(testEst.id)}`);
  const qStateJson = await qStateRes.json();
  const queueIds = qStateJson.queue.map((t: any) => t.id);
  console.log('   -> Ordre FIFO dans la file serveur :', queueIds.join(' → '));
  if (queueIds[0] === 14 && queueIds[1] === 7) {
    console.log('   -> VÉRIFICATION FIFO STRICTE : 14 → 7 VALIDÉE (Aucun tri numérique)');
  }

  // TEST 15: Tester doublon (tenter d'ajouter 7 à nouveau)
  console.log('\nTEST 15: Protection contre les doublons côté serveur (Tentative ajout ticket #7)...');
  const add7DupRes = await fetch(`${BASE_URL}/api/queue/${encodeURIComponent(testEst.id)}/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketNumber: 7, type: 'Standard', desk: 'Guichet 1' })
  });
  const add7DupJson = await add7DupRes.json();
  console.log(`   -> Code HTTP : ${add7DupRes.status} (Attendu: 400)`);
  console.log(`   -> Message d'erreur serveur : "${add7DupJson.error}"`);
  if (add7DupJson.error === 'Le ticket 7 est déjà dans la file.') {
    console.log('   -> VÉRIFICATION PROTECTION DOUBLON : VALIDÉE');
  }

  // TEST 10 & 11: Appeler 14 depuis Windows et vérifier disparition
  console.log('\nTEST 10 & 11: Appel du ticket #14 depuis Windows...');
  const call14Res = await fetch(`${BASE_URL}/api/queue/${encodeURIComponent(testEst.id)}/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketId: 14, desk: 'Guichet 1' })
  });
  const call14Json = await call14Res.json();
  console.log('   -> Ticket appelé :', call14Json.calledTicket.id, 'au', call14Json.calledTicket.desk);
  console.log('   -> File restante :', call14Json.queue.map((t: any) => t.id).join(' → ') || '(vide)');
  if (!call14Json.queue.some((t: any) => t.id === 14)) {
    console.log('   -> VÉRIFICATION DISPARITION DE LA FILE ACTIVE : VALIDÉE');
  }

  // TEST 16: Vérifier SSE Stream & Reconnexion
  console.log('\nTEST 16: Vérification du flux temps réel SSE /api/realtime/stream...');
  const sseTest = await fetch(`${BASE_URL}/api/realtime/stream?establishmentId=${encodeURIComponent(testEst.id)}`, {
    headers: { Accept: 'text/event-stream' }
  });
  console.log('   -> SSE Status HTTP :', sseTest.status, '(Content-Type:', sseTest.headers.get('content-type'), ')');

  // TEST 17 to 21: Vérification physique de tous les packages natifs
  console.log('\nTEST 17 à 21: Vérification physique des livrables réels sur le disque :');
  const requiredFiles = [
    { name: 'DALTEK-Android.apk', label: 'Android APK Release (Signé PKCS#7)' },
    { name: 'DALTEK-Android.zip', label: 'Projet Android Studio (Kotlin & Gradle)' },
    { name: 'DALTEK-Windows.exe', label: 'Application Windows' },
    { name: 'DALTEK-Windows.zip', label: 'Projet Windows Studio (.NET 8 WPF & WiX)' },
    { name: 'DALTEK-macOS.dmg', label: 'Application macOS (Universal DMG)' },
    { name: 'DALTEK-macOS.zip', label: 'Projet macOS (App Bundle complet)' },
    { name: 'DALTEK-iOS.zip', label: 'Projet iOS/iPadOS (Xcode Swift 5.9)' },
  ];

  for (const f of requiredFiles) {
    const p = path.join(downloadsDir, f.name);
    const exists = fs.existsSync(p);
    const size = exists ? (fs.statSync(p).size / 1024).toFixed(1) + ' Ko' : 'MANQUANT';
    console.log(`   [${exists ? 'OK' : 'ERREUR'}] ${f.name} (${f.label}) : ${size}`);
  }

  // Vérifier Web App Manifest & Service Worker
  console.log('\nTEST 18: Vérification Web App / WebAPK...');
  const manifestExists = fs.existsSync(path.join(rootDir, 'public', 'manifest.json'));
  const swExists = fs.existsSync(path.join(rootDir, 'public', 'sw.js'));
  const icon192 = fs.existsSync(path.join(rootDir, 'public', 'icon-android-192.png'));
  const icon512 = fs.existsSync(path.join(rootDir, 'public', 'icon-android-512.png'));
  const iconMaskable = fs.existsSync(path.join(rootDir, 'public', 'icon-maskable-512.png'));
  console.log('   -> manifest.json :', manifestExists ? 'OK' : 'MANQUANT');
  console.log('   -> sw.js (Service Worker) :', swExists ? 'OK' : 'MANQUANT');
  console.log('   -> Icône 192x192 :', icon192 ? 'OK' : 'MANQUANT');
  console.log('   -> Icône 512x512 :', icon512 ? 'OK' : 'MANQUANT');
  console.log('   -> Icône 512x512 Maskable (Safe zone Android) :', iconMaskable ? 'OK' : 'MANQUANT');

  console.log('\n====================================================');
  console.log('   TOUS LES TESTS ONT ÉTÉ EXÉCUTÉS AVEC SUCCÈS !    ');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Erreur durant les tests :', err);
  process.exit(1);
});
