const { loginAndGetCookie, fetchHoldsPage, parseBodyForBooks } = require('./utils');

const go = async () => {
  const cookies = await loginAndGetCookie();
  const body = await fetchHoldsPage(cookies);
  const booksOnHold = parseBodyForBooks(body);
  console.log(booksOnHold);
}

go();
