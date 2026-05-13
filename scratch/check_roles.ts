
import { api } from './services/api';

async function checkRoles() {
    try {
        const roles = await api.getRoles();
        console.log('Roles in DB:', JSON.stringify(roles, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkRoles();
