/* TRIPA — Registre des entités côté serveur (source de vérité pour la sécurité).
 * Le frontend a sa propre copie pour l'affichage ; les colonnes autorisées
 * sont TOUJOURS validées ici, jamais depuis le client. */

// Type de colonne : 'text' | 'num' | 'bool'
const ENTITIES = {
  adherents: {
    label: 'Adhérents',
    cols: {
      nom: 'text', prenom: 'text', email: 'text', telephone: 'text',
      categorie: 'text', statut: 'text', date_adhesion: 'text', note: 'text'
    }
  },
  cotisations: {
    label: 'Cotisations',
    cols: {
      adherent_id: 'text', montant: 'num', periode: 'text', statut: 'text',
      date_paiement: 'text', mode_paiement: 'text'
    }
  },
  evenements: {
    label: 'Événements',
    cols: {
      titre: 'text', type: 'text', date: 'text', heure: 'text', lieu: 'text',
      capacite: 'num', tarif: 'num', statut: 'text'
    }
  },
  activites: {
    label: 'Activités',
    cols: {
      nom: 'text', responsable: 'text', date: 'text', lieu: 'text',
      description: 'text', statut: 'text'
    }
  },
  communications: {
    label: 'Annonces',
    cols: {
      titre: 'text', contenu: 'text', canal: 'text', date_publication: 'text', epingle: 'bool'
    }
  },
  achats: {
    label: 'Achats',
    cols: {
      fournisseur: 'text', categorie: 'text', montant: 'num', date: 'text', statut_paiement: 'text'
    }
  },
  documents: {
    label: 'Documents',
    cols: { nom: 'text', categorie: 'text', taille: 'text', url: 'text' }
  },
  taches: {
    label: 'Tâches',
    cols: {
      libelle: 'text', assigne: 'text', priorite: 'text', echeance: 'text', statut: 'text'
    }
  }
};

// Colonnes utilisateur modifiables (jamais password_hash/role via ces routes)
const USER_PUBLIC = ['nom', 'prenom', 'telephone', 'asso_type', 'status'];

module.exports = { ENTITIES, USER_PUBLIC, ENTITY_KEYS: Object.keys(ENTITIES) };
