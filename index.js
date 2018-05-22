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
  sendNotificationForHighAlerts
} = require('./utils');

const go = async (event) => {
  const cookies = await loginAndGetCookie();
  const body = await fetchHoldsPage(cookies);
  const holdsFromDB = await retrieveCurrentHoldsFromDB();
  const booksOnHold = parseBodyForBooks(body);

  if (moment().format('dddd') === 'Monday') {
    // do normal monday morning notification
    const booksForNotification = decorateData(holdsFromDB, booksOnHold);
    await updateDatabase(booksForNotification);
    await sendNotification(booksForNotification);
  } else {
    // do a check to see if a book has moved up a spot.
    const booksForHighAlertNotification = retrieveHighAlertHolds(holdsFromDB, booksOnHold);
    await updatDatabaseForHighAlerts(booksForHighAlertNotification);
    await sendNotificationForHighAlerts(booksForHighAlertNotification);
  }

  return;
}

// for aws lamdba:
exports.handler = go;

// when testing locally:
// go();
