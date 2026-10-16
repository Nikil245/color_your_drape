const { db } = require('../config/firebase');

const COLLECTIONS = Object.freeze({
  real: Object.freeze({
    orders: 'orders',
    inventory: 'inventory',
    customers: 'customers',
    settings: 'settings',
    users: 'users',
  }),
  demo: Object.freeze({
    orders: 'demo_orders',
    inventory: 'demo_inventory',
    customers: 'demo_customers',
    settings: 'demo_settings',
    users: 'demo_users',
  }),
});

function collectionFor(req, logicalName) {
  const scope = req?.dataScope;
  if (scope !== 'real' && scope !== 'demo') {
    throw new Error('Firestore data scope is missing or invalid.');
  }
  const name = COLLECTIONS[scope][logicalName];
  if (!name) throw new Error(`Unrecognized Firestore collection: ${logicalName}`);
  return db.collection(name);
}

// Public login, registration, and guarded account maintenance always use real users.
// These operations are deliberately explicit and are never reachable from demo sessions.
function accountCollection(logicalName) {
  if (logicalName !== 'users') throw new Error(`Unrecognized account collection: ${logicalName}`);
  return db.collection(COLLECTIONS.real.users);
}

function runTransaction(req, callback) {
  if (req?.dataScope !== 'real' && req?.dataScope !== 'demo') {
    throw new Error('Firestore data scope is missing or invalid.');
  }
  return db.runTransaction(callback);
}

module.exports = { collectionFor, accountCollection, runTransaction };
