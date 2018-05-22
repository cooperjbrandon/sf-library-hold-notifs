////////////////////////
/// npm dependencies ///
////////////////////////
const cheerio = require('cheerio');
const firebase = require('firebase-admin');
const mg = require('mailgun-js');

////////////////////////
/// load local files ///
////////////////////////
const fetch = require('./fetch');
const {
  username,
  password,
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

/////////////////
/// functions ///
/////////////////
const loginAndGetCookie = async () => {
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
    booksOnHold.push({title, position: parseInt(position), positionText});
  });

  return booksOnHold;
};

const retrieveCurrentHoldsFromDB = async () => {
  console.log('retrieveCurrentHoldsFromDB');
  const books = await db.ref('users/brandon/books').once('value');
  return books.val() || [];
}

const addPositionChangeData = (holdsFromDB, booksOnHold) => {
  console.log('addPositionChangeData');
  let weeklyNotificationData = [];
  for (let book of booksOnHold) {
    let bookFromDB = holdsFromDB.find((bookToCheck) => {
      return bookToCheck.title === book.title;
    });

    let positionChange, positionChangeFromLastWeek;
    if (bookFromDB) {
      positionChangeFromLastWeek = bookFromDB.position - book.position;
      let spotText = positionChangeFromLastWeek === 1 ? 'spot' : 'spots';
      positionChange = `This book moved up ${positionChangeFromLastWeek} ${spotText} from last week.`
    } else {
      positionChangeFromLastWeek = 0;
      positionChange = 'Newly added in the last week.';
    }

    weeklyNotificationData.push({ ...book, positionChange, positionChangeFromLastWeek });
  }

  return weeklyNotificationData;
}

const updateDatabase = async (booksForNotification) => {
  console.log('updateDatabase');
  try {
    await db.ref('users/brandon/books').set(booksForNotification);
  } catch (error) {
    console.log(error);
  }
}

const sendNotification = async (booksForNotification) => {
  console.log('sendNotification');
  try {
    let data = {
      from: `Hello From Brandon <ignore@${domain}>`,
      // to: 'malloryannrossen@gmail.com, cooperjbrandon@gmail.com',
      to: 'cooperjbrandon@gmail.com',
      subject: 'Your Weekly SF Library Hold Notifications',
      text: JSON.stringify(booksForNotification),
      html: formatEmail(booksForNotification)
    };

    return mailgun.messages().send(data);
  } catch (error) {
    console.log(error);
  }
}

const formatEmail = (booksForNotification) => {
  let body = '';

  for (let book of booksForNotification) {
    let title = `<p><b>${book.title}</b></p>`;
    let list = `
      <ul>
        <li>Current Position: ${book.position}</li>
        <li>Change: ${book.positionChange}</li>
        <li>Position Text: ${book.positionText}</li>
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
  addPositionChangeData,
  updateDatabase,
  sendNotification,
};
