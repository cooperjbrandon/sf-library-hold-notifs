////////////////////////
/// npm dependencies ///
////////////////////////
const cheerio = require('cheerio');
const firebase = require('firebase-admin');
const mg = require('mailgun-js');
const moment = require('moment');

////////////////////////
/// load local files ///
////////////////////////
const fetch = require('./fetch');
const {
  mailgunSecrets: { apiKey, domain },
  firebaseServiceAccount
} = require('./secrets');

///////////////////////////////////////
/// initialize firebase and mailgun ///
///////////////////////////////////////
firebase.initializeApp({
  credential: firebase.credential.cert(firebaseServiceAccount),
  databaseURL: 'https://sf-library-hold-notifs.firebaseio.com/',
});

const db = firebase.database();

const mailgun = mg({ apiKey, domain });

//////////////////////////
/// exported functions ///
//////////////////////////
const loginAndGetCookie = async (username, password) => {
  console.log('loginAndGetCookie');

  try {
    const url = 'https://sfpl.bibliocommons.com/user/login';
    const method = 'POST';
    const form = {
      name: username,
      user_pin: password
    };
    const { response } = await fetch({url, method, form});
    const cookies = response.headers['set-cookie'];
    return cookies.join('; ');
  } catch (error) {
    console.log(error);
  }
}

const fetchHoldsPage = async (cookies) => {
  console.log('fetchHoldsPage');

  try {
    const url = 'https://sfpl.bibliocommons.com/holds/index/not_yet_available';
    const method = 'GET';
    const headers = {
      Cookie: cookies
    };
    const { body } = await fetch({url, method, headers});
    return body;
  } catch (error) {
    console.log(error);
  }
}

const parseBodyForBooks = (body) => {
  console.log('parseBodyForBooks');

  const $ = cheerio.load(body);
  let booksOnHold = [];

  $('.cp_bib_list .listItem').each((index, element) => {
    let title = $(element).find('.title.title_extended a').attr('title');
    let position = $(element).find('.hold_position strong').text().slice(1); // (slice strips the pound symbol). #5 => 5; or #13 => 13
    let positionText = $(element).find('.hold_position').text().trim();
    position = position ? parseInt(position) : ''; // edge case when there is no position (when it just says PROCESSING HOLD)
    booksOnHold.push({title, position, positionText});
  });

  return booksOnHold;
};

const retrieveCurrentHoldsFromDB = async (name) => {
  console.log('retrieveCurrentHoldsFromDB');
  const books = await db.ref(`users/${name}/books`).once('value');
  return books.val() || [];
}

const decorateData = (holdsFromDB, booksOnHold) => {
  console.log('decorateData');

  let weeklyNotificationData = {};
  for (let book of booksOnHold) {

    const keyName = getKeyName(book.title);
    const bookFromDB = holdsFromDB[keyName];

    let positionChange, positionChangeFromLastUpdate;
    if (bookFromDB) {
      positionChangeFromLastUpdate = bookFromDB.position && book.position ? bookFromDB.position - book.position : 0;
      positionChange = getPositionChangeText(bookFromDB, positionChangeFromLastUpdate);
    } else {
      positionChangeFromLastUpdate = 0;
      positionChange = 'Newly added in the last week.';
    }

    weeklyNotificationData[keyName] = {
      ...book,
      positionChange,
      positionChangeFromLastUpdate,
      lastUpdated: new Date().toString()
    };
  }

  return weeklyNotificationData;
}

const retrieveHighAlertHolds = (holdsFromDB, booksOnHold) => {
  console.log('retrieveHighAlertHolds');

  let highAlertData = {};
  for (let book of booksOnHold) {

    const keyName = getKeyName(book.title);
    const bookFromDB = holdsFromDB[keyName];

    const positionChangeFromLastUpdate = bookFromDB && bookFromDB.position && book.position ? bookFromDB.position - book.position : 0;

    // only keep going in this loop if the position has changed and the book's position is <= 5
    const canKeepGoing = positionChangeFromLastUpdate > 0 && book.position <= 5;
    if (!canKeepGoing) { continue; }

    const positionChange = getPositionChangeText(bookFromDB, positionChangeFromLastUpdate);
    highAlertData[keyName] = {
      ...book,
      positionChange,
      positionChangeFromLastUpdate,
      lastUpdated: new Date().toString()
    };
  }

  return highAlertData;
}

const updateDatabase = async (booksForNotification, name) => {
  console.log('updateDatabase');

  try {
    // completely overwrite the books for this user
    await db.ref(`users/${name}/books`).set(booksForNotification);
  } catch (error) {
    console.log(error);
  }
}

const sendNotification = async (booksForNotification, email) => {
  console.log('sendNotification');

  try {
    let data = {
      from: `Hello From Brandon <ignore@${domain}>`,
      to: email,
      subject: 'Your Weekly SF Library Hold Notifications',
      text: formatEmailText(booksForNotification),
      html: formatEmailHtml(booksForNotification)
    };

    return mailgun.messages().send(data);
  } catch (error) {
    console.log(error);
  }
}

const updatDatabaseForHighAlerts = async (booksForHighAlertNotification, name) => {
  console.log('updatDatabaseForHighAlerts');

  try {
    // only update the necessary books for this user
    await db.ref(`users/${name}/books`).update(booksForHighAlertNotification);
  } catch (error) {
    console.log(error);
  }
}

const sendNotificationForHighAlerts = async (booksForHighAlertNotification, email) => {
  console.log('sendNotificationForHighAlerts');

  if (!Object.keys(booksForHighAlertNotification).length) { return Promise.resolve(); }

  try {
    let data = {
      from: `Hello From Brandon <ignore@${domain}>`,
      to: email,
      subject: 'High Alert - SF Library Hold Notifications',
      text: formatEmailText(booksForHighAlertNotification),
      html: formatEmailHtml(booksForHighAlertNotification)
    };

    return mailgun.messages().send(data);
  } catch (error) {
    console.log(error);
  }
}

const logBooksForRecordKeeping = (name, holdsFromDB, booksOnHold) => {
  console.log(`${name} holds from DB: ${JSON.stringify(holdsFromDB, null, 4)}`);
  console.log(`${name} current holds from library: ${JSON.stringify(booksOnHold, null, 4)}`);
}


////////////////////////
/// Helper functions ///
////////////////////////

const getKeyName = (title) => {
  return title.split('.').join('___');
}

const getPositionChangeText = (bookFromDB, positionChangeFromLastUpdate) => {
  let spotText = positionChangeFromLastUpdate === 1 ? 'spot' : 'spots';
  let fromText = moment(new Date(bookFromDB.lastUpdated)).fromNow();
  return `This book has moved up ${positionChangeFromLastUpdate} ${spotText} from ${fromText}.`
}

const formatEmailText = (booksForNotification) => {
  return Object.keys(booksForNotification).length ? JSON.stringify(booksForNotification) : 'You have no current holds.';
}

const formatEmailHtml = (booksForNotification) => {
  let body = Object.keys(booksForNotification).length ? '' : 'You have no current holds.';

  for (let bookKeyName of Object.keys(booksForNotification)) {
    let book = booksForNotification[bookKeyName];
    let title = `<p><b>${book.title}</b></p>`;
    let list = `
      <ul>
        <li>Current Position: ${book.position}</li>
        <li>Change: ${book.positionChange}</li>
        <li>Info: ${book.positionText}</li>
      </ul>
    `;
    body += title;
    body += list;
  }

  return `<html><body>${body}</body></html>`
}

///////////////
/// exports ///
///////////////
module.exports = {
  loginAndGetCookie,
  fetchHoldsPage,
  parseBodyForBooks,
  retrieveCurrentHoldsFromDB,
  decorateData,
  retrieveHighAlertHolds,
  updateDatabase,
  sendNotification,
  updatDatabaseForHighAlerts,
  sendNotificationForHighAlerts,
  logBooksForRecordKeeping
};
