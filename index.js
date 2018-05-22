const {
	loginAndGetCookie,
	fetchHoldsPage,
	parseBodyForBooks,
  retrieveCurrentHoldsFromDB,
  addPositionChangeData,
  updateDatabase,
	sendNotification,
} = require('./utils');

const go = async () => {
  const cookies = await loginAndGetCookie();
  const body = await fetchHoldsPage(cookies);
  const holdsFromDB = await retrieveCurrentHoldsFromDB();

  const booksOnHold = parseBodyForBooks(body);
  const booksForNotification = addPositionChangeData(holdsFromDB, booksOnHold);

  await updateDatabase(booksForNotification);
  await sendNotification(booksForNotification);

  process.exit()
}

go();
