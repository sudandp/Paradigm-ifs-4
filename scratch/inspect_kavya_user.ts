import { api } from '../services/api';

async function testKavyaUser() {
  const users = await api.getUsers();
  const kavya = users.find(u => u.name === 'Kavya M');
  console.log('Kavya user from api.getUsers():', kavya);
}

testKavyaUser().catch(console.error);
