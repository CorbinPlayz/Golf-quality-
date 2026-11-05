import {initializeDatabase,db} from './db';
initializeDatabase();
console.log('Course catalog initialized. Existing records are preserved.');
db.close();
