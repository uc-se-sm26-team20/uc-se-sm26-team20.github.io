// =============================================================================
// EECE/CS 3093C Software Engineering — Sprint 2
// messengerdb.js — code skeleton provided by Phu Phung
// complete implementation by Team 20
// =============================================================================
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

const uri = "mongodb+srv://Admin:Administrator@messenger.odudlov.mongodb.net/?appName=Messenger"; //replace this with your connection string
const client = new MongoClient(uri);

async function connect (){
  await client.connect();
  console.log('Debug>messengerdb.js: connected to MongoDB server!');
}

let users = client.db('Messenger').collection('Users');
//UCse-Case-03: Join Chat
const find = async (username, password)=> {
  let user = null;
  console.log(`Debug>messengerdb.js: find user '${username}'`)
  if (typeof username !== 'string' || typeof password !== 'string') return null;
  //AC-03.3 
  user = await users.findOne({username:username});
  if (!user) return null;
  //AC-03.3
  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) return null;
  return user;
}

//UC05 Register Account

const register = async (username, password) => {

  console.log(`Debug>messengerdb.js: register username '${username}'`);

  //AC 05.4
  const  usernamePattern = /^\w{3,20}$/;
  const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
  if (!usernamePattern.test(username) || !passwordPattern.test(password))
    return { success: false, message: 'Invalid username or password' }; // AC-05.8
  
  //Ac-05.5
  const existing = await users.findOne({ username: username });
  if (existing)
    return { success: false, message: 'Username already exists' }; // AC-05.8

  //AC-05.6
  const hashedPassword = await bcrypt.hash(password, 10);
  await users.insertOne({ username: username, password: hashedPassword });
  return { success: true, message: 'User registered successfully' }; //Ac-05.7
};



module.exports = { connect, find, register };
