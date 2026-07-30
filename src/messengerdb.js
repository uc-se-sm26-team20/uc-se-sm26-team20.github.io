// =============================================================================
// EECE/CS 3093C Software Engineering — Sprint 2
// messengerdb.js — code skeleton provided by Phu Phung
// complete implementation by Team 20
// =============================================================================
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

const uri = "mongodb+srv://Admin:Administrator@messenger.odudlov.mongodb.net/?appName=Messenger"; //replace this with your connection string
const client = new MongoClient(uri);

let users;
let messages;
let groupChats;

async function connect (){
  await client.connect();
  const db = client.db('Messenger');
  users = db.collection('Users');
  messages = db.collection('Messages');
  groupChats = db.collection('GroupChats');
  await groupChats.createIndex({ name: 1 }, { unique: true });
  await ensureGlobalGroupChat();
  console.log('Debug>messengerdb.js: connected to MongoDB server!');
}

async function ensureGlobalGroupChat() {
  const globalGroup = await groupChats.findOneAndUpdate(
    { name: 'Global' },
    {
      $setOnInsert: {
        name: 'Global',
        createdBy: null,
        members: [],
        createdAt: new Date()
      },
      $set: {
        updatedAt: new Date()
      }
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  );

  return globalGroup;
}

//UCse-Case-03: Join Chat
const find = async (username, password)=> {
  let user = null;
  console.log(`Debug>messengerdb.js: find user '${username}'`);
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
  const globalGroup = await ensureGlobalGroupChat();
  const result = await users.insertOne({
    username: username,
    password: hashedPassword,
    groupChats: [globalGroup._id]
  });

  await groupChats.updateOne(
    { _id: globalGroup._id },
    {
      $addToSet: { members: result.insertedId },
      $set: { updatedAt: new Date() }
    }
  );

  return { success: true, message: 'User registered successfully' }; //Ac-05.7
};

// UC-Profile Update: In-place update logic
const updateProfile = async (oldUsername, newUsername, newPassword) => {
  const oldU = String(oldUsername || "").trim();
  const newU = String(newUsername || "").trim();

  console.log(`Debug>messengerdb.js: updating profile for '${oldU}' to '${newU}'`);

  const usernamePattern = /^\w{3,20}$/;
  const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

  if (!usernamePattern.test(newU) || !passwordPattern.test(newPassword)) {
    return { success: false, message: 'Invalid username or password format' };
  }

  // Check if new username is taken by someone else
  if (newU !== oldU) {
    const existing = await users.findOne({ username: newU });
    if (existing) return { success: false, message: 'Username already exists' };
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Perform the update in-place
  const result = await users.updateOne(
    { username: oldU },
    { $set: { username: newU, password: hashedPassword } }
  );

  if (result.matchedCount === 0) {
    return { success: false, message: 'Original user not found in database' };
  }

  return { success: true, message: 'Profile updated successfully' };
};

// UC-Chat History: persist and retrieve messages so history survives logout/reconnect
const saveGroupMessage = async (group, from, message) => {
  const doc = { kind: 'group', group, from, message, timestamp: new Date() };
  await messages.insertOne(doc);
  return doc;
};

const savePrivateMessage = async (from, to, message) => {
  const doc = { kind: 'private', from, to, message, timestamp: new Date() };
  await messages.insertOne(doc);
  return doc;
};

const getGroupHistory = async (group, limit = 100) => {
  const docs = await messages
    .find({ kind: 'group', group })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
  return docs.reverse();
};

const getPrivateHistory = async (username, limit = 100) => {
  const docs = await messages
    .find({ kind: 'private', $or: [{ from: username }, { to: username }] })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
  return docs.reverse();
};

const getAllGroupChatNames = async () => {
  const chats = await groupChats
    .find({}, { projection: { name: 1 } })
    .sort({ name: 1 })
    .toArray();

  return chats
    .map((chat) => chat.name)
    .filter((name) => typeof name === 'string' && name.trim());
};

const getUserGroupChats = async (username) => {
  const user = await users.findOne(
    { username: username },
    { projection: { groupChats: 1 } }
  );

  if (!user) return [];

  const globalGroup = await ensureGlobalGroupChat();

  await users.updateOne(
    { _id: user._id },
    { $addToSet: { groupChats: globalGroup._id } }
  );

  await groupChats.updateOne(
    { _id: globalGroup._id },
    {
      $addToSet: { members: user._id },
      $set: { updatedAt: new Date() }
    }
  );

  const groupIds = Array.isArray(user.groupChats)
    ? user.groupChats.concat(globalGroup._id)
    : [globalGroup._id];

  const chats = await groupChats
    .find(
      { _id: { $in: groupIds } },
      { projection: { name: 1 } }
    )
    .sort({ name: 1 })
    .toArray();

  return chats
    .map((chat) => chat.name)
    .filter((name) => typeof name === 'string' && name.trim());
};

const createGroupChat = async (creatorUsername, groupName) => {
  const name = String(groupName || '').trim();
  if (!name) return { success: false, message: 'Group name is required' };

  const creator = await users.findOne({ username: creatorUsername });
  if (!creator) return { success: false, message: 'Creator user not found' };

  const existing = await groupChats.findOne({ name: name });
  if (existing) return { success: false, message: 'Group already exists' };

  const now = new Date();
  let result;

  try {
    result = await groupChats.insertOne({
      name: name,
      createdBy: creator._id,
      members: [creator._id],
      createdAt: now,
      updatedAt: now
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return { success: false, message: 'Group already exists' };
    }

    throw error;
  }

  await users.updateOne(
    { _id: creator._id },
    { $addToSet: { groupChats: result.insertedId } }
  );

  return {
    success: true,
    message: 'Group created successfully',
    group: {
      _id: result.insertedId,
      name: name
    }
  };
};

const updateUserGroupChat = async (username, groupName, action) => {
  const user = await users.findOne({ username: username });
  if (!user) return { success: false, message: 'User not found' };

  const group = await groupChats.findOne({ name: groupName });
  if (!group) return { success: false, message: 'Group not found' };

  if (action === 'add') {
    await users.updateOne(
      { _id: user._id },
      { $addToSet: { groupChats: group._id } }
    );

    await groupChats.updateOne(
      { _id: group._id },
      {
        $addToSet: { members: user._id },
        $set: { updatedAt: new Date() }
      }
    );

    return { success: true, message: 'User added to group' };
  }

  if (action === 'delete') {
    await users.updateOne(
      { _id: user._id },
      { $pull: { groupChats: group._id } }
    );

    await groupChats.updateOne(
      { _id: group._id },
      {
        $pull: { members: user._id },
        $set: { updatedAt: new Date() }
      }
    );

    return { success: true, message: 'User removed from group' };
  }

  return { success: false, message: 'Invalid group action' };
};

module.exports = {
  connect,
  find,
  register,
  updateProfile,
  saveGroupMessage,
  savePrivateMessage,
  getGroupHistory,
  getPrivateHistory,
  getAllGroupChatNames,
  getUserGroupChats,
  createGroupChat,
  updateUserGroupChat
};
