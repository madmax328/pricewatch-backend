# 🎯 PriceWatch Backend API

Backend de scraping en temps réel pour PriceWatch - Comparateur de prix intelligent.

## 🚀 Déploiement sur Railway (Gratuit)

### Étape 1 : Préparer le projet

```bash
cd backend
npm install
```

### Étape 2 : Créer un compte Railway

1. Va sur [railway.app](https://railway.app)
2. Connecte-toi avec GitHub
3. C'est gratuit jusqu'à $5/mois de ressources

### Étape 3 : Déployer

**Option A : Via GitHub (Recommandé)**

1. Pousse ce dossier `backend/` sur GitHub
2. Dans Railway : "New Project" → "Deploy from GitHub"
3. Sélectionne ton repo
4. Railway détecte automatiquement Node.js
5. Le déploiement se lance automatiquement

**Option B : Via Railway CLI**

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialiser
railway init

# Déployer
railway up
```

### Étape 4 : Obtenir l'URL de l'API

Une fois déployé :
1. Va dans ton projet Railway
2. Clique sur "Settings"
3. Tu verras l'URL publique (ex: `https://pricewatch-production.up.railway.app`)
4. **Copie cette URL** - tu en auras besoin pour l'extension !

## 🧪 Tester en Local

```bash
# Installer les dépendances
npm install

# Lancer le serveur
npm start

# Ou en mode dev (avec auto-reload)
npm run dev

# Tester le scraper
npm test
```

Le serveur démarre sur `http://localhost:3000`

### Tester l'API

```bash
# Test simple
curl "http://localhost:3000/api/compare?q=iPhone+15"

# Ou dans ton navigateur
http://localhost:3000/api/compare?q=iPhone+15
```

## 📡 Endpoints API

### `GET /`
Informations sur l'API

### `GET /health`
Health check du serveur

### `POST /api/compare`
Compare les prix pour un produit

**Body:**
```json
{
  "query": "iPhone 15 Pro"
}
```

**Response:**
```json
{
  "query": "iPhone 15 Pro",
  "totalResults": 15,
  "results": [
    {
      "title": "Apple iPhone 15 Pro 128GB...",
      "price": 1159.99,
      "url": "https://www.amazon.fr/...",
      "image": "https://...",
      "site": "Amazon",
      "availability": "En stock"
    }
  ],
  "timestamp": "2024-01-08T10:30:00.000Z",
  "cached": false
}
```

### `GET /api/compare?q=<query>`
Version GET (plus simple pour tester)

### `GET /api/stats`
Statistiques du serveur (cache, uptime, etc.)

## 🛠️ Sites Scrapés

- ✅ Amazon.fr
- ✅ Fnac.com
- ✅ Darty.com
- ✅ Boulanger.com
- ✅ Cdiscount.com
- ✅ Materiel.net
- ✅ LDLC.com

## ⚡ Performance

- **Cache intelligent** : 1 heure de cache par recherche
- **Requêtes parallèles** : Tous les sites scrapés en même temps
- **Timeout** : 10 secondes max par site
- **Retry** : 2 tentatives automatiques en cas d'échec

## 🔧 Configuration

Variables d'environnement (fichier `.env`) :

```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*
```

Sur Railway, ces variables sont configurées automatiquement.

## 📊 Monitoring

Railway fournit :
- Logs en temps réel
- Métriques (CPU, RAM, Network)
- Alertes automatiques
- Dashboard de monitoring

## 💰 Coûts

**Railway Plan Gratuit :**
- $5 de crédit gratuit/mois
- Suffisant pour ~500-1000 requêtes/jour
- Pas de carte de crédit requise

**Si tu dépasses :**
- Pay-as-you-go : ~$0.000231/GB-hour
- Pour 5000 utilisateurs : ~$10-20/mois

## 🐛 Debug

### Voir les logs sur Railway

1. Va dans ton projet
2. Onglet "Deployments"
3. Clique sur le dernier deployment
4. Onglet "Logs"

### Logs locaux

Les logs s'affichent directement dans le terminal :
```
🔍 Scraping prices for: "iPhone 15"
✅ Found 12 results
```

## 🚨 Problèmes Courants

### Le scraping échoue
- Certains sites peuvent bloquer temporairement
- Le scraper a des user-agents rotatifs et retry automatique
- Les résultats des sites qui échouent sont simplement ignorés

### Timeout
- Augmente `SCRAPING_TIMEOUT` dans `config/config.js`
- Par défaut : 10 secondes

### Trop de requêtes
- Le cache évite de re-scraper le même produit
- Durée du cache : 1 heure (configurable)

## 🔄 Mise à Jour

Sur Railway, les mises à jour sont automatiques :
1. Pousse ton code sur GitHub
2. Railway redéploie automatiquement
3. Zero downtime !

## 📝 Notes Importantes

- **Rate Limiting** : Les sites peuvent limiter les requêtes. Le cache aide à éviter ça.
- **Sélecteurs CSS** : Les sites changent leurs sélecteurs. Prévoir de les mettre à jour.
- **Légalité** : Le scraping est dans une zone grise. On récupère des données publiques sans login.

## 🎯 Prochaines Étapes

Une fois déployé sur Railway :
1. Note l'URL de ton API
2. Configure l'extension Chrome avec cette URL
3. Teste l'extension !

## 🤝 Support

Si problème avec Railway :
- [Documentation Railway](https://docs.railway.app)
- [Discord Railway](https://discord.gg/railway)
- [Status Page](https://status.railway.app)

---

**Ready to deploy? Let's go! 🚀**
