# Novaris — Architecture & Progression

> Document de référence du projet Novaris — point de vérité unique
> Source : état du projet (Plane) + constats techniques

## 1. Architecture

- **Base de données** : PostgreSQL
- **Modules structurants** (tous en statut *planned*) :
  - Institution
  - Ressources
  - Formation
  - Évaluation

## 2. État global (32 work items)

| Groupe | Compte | % |
|--------|--------|-----|
| ✅ Complétées | 16 | 50 % |
| 🔵 En cours | 8 | 25 % |
| ⚪ À faire | 6 | 19 % |
| 📁 Backlog | 1 | 3 % |
| ❌ Annulées | 1 | 3 % |

**Taux de complétion : 50 %**

## 3. Fonctionnalités complétées

- Séparation des cours pour collaborateurs
- Restriction propriétaire des quiz
- Restauration de versions de cours
- *(+ 13 autres items clôturés)*

## 4. En cours (8)

1. Assistant IA pour aider l'apprenant à évoluer rapidement, avec support audio *(high)*
2. Seul le créateur d'une ressource peut la modifier *(high)*
3. Génération de certificats pour cours/formations complétés *(medium)*
4. Implémenter toutes les fonctionnalités de formations et cours pour les institutions *(medium)*
5. Enregistrement et gestion des dossiers des étudiants pour les institutions *(medium)*
6. Création d'offres d'emploi/formation pour les institutions *(medium)*
7. Générer un lien d'invitation sécurisé pour les examens de sélection par email *(medium)*
8. Notifier les apprenants des modifications du cours

## 5. À faire (6)

- FIX: KeyError 'id' dans `study_ai_service.py` *(high)*
- Utiliser le module Évaluation pour préparer les examens de passage des offres *(medium)*
- Améliorer le contexte utilisateur pour l'assistant d'étude
- Réponses basées sur le contenu spécifique du cours
- Support multimodal (texte + audio) pour l'assistant
- Système de recommandations personnalisées

## 6. Backlog

- [DEPENDS ON AI MODERATION] Archivage automatique du cours par IA

---

*Dernière mise à jour : 2026-09-06*