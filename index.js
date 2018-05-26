const moment = require('moment');
const {
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
} = require('./utils');
const {
  libraryUsers
} = require('./secrets');

const performNotifs = async (user) => {
  const cookies = await loginAndGetCookie(user.username, user.password);
  const body = await fetchHoldsPage(cookies);
  const holdsFromDB = await retrieveCurrentHoldsFromDB(user.name);
  const booksOnHold = parseBodyForBooks(body);
  logBooksForRecordKeeping(user.name, holdsFromDB, booksOnHold);

  if (moment().format('dddd') === 'Monday') {
    // do normal monday morning notification
    const booksForNotification = decorateData(holdsFromDB, booksOnHold);
    await updateDatabase(booksForNotification, user.name);
    await sendNotification(booksForNotification, user.email);
  } else {
    // do a check to see if a book has moved up a spot.
    const booksForHighAlertNotification = retrieveHighAlertHolds(holdsFromDB, booksOnHold);
    await updatDatabaseForHighAlerts(booksForHighAlertNotification, user.name);
    await sendNotificationForHighAlerts(booksForHighAlertNotification, user.email);
  }
}

const go = async () => {
  for (let user of libraryUsers) {
    await performNotifs(user);
  }

  return;
}

// for aws lamdba:
exports.handler = go;

// when testing locally:
// go();
