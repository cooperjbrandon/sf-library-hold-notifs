const fetch = require('./fetch');
const cheerio = require('cheerio');

const loginAndGetCookie = async () => {
  console.log('loginAndGetCookie');

  try {
    const url = 'https://sfpl.bibliocommons.com/user/login';
    const method = 'POST';
    const form = {
      name: 'username',
      user_pin: 'password'
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
  const $ = cheerio.load(body);
  let booksOnHold = [];

  $('.cp_bib_list .listItem').each((index, element) => {
    let title = $(element).find('.title.title_extended a').attr('title');
    let position = $(element).find('.hold_position strong').text().slice(1); // (slice strips the pound symbol). #5 => 5; or #13 => 13
    let positionText = $(element).find('.hold_position').text().trim();
    booksOnHold.push({title, position, positionText});
  });

  return booksOnHold;
};

module.exports = { loginAndGetCookie, fetchHoldsPage, parseBodyForBooks };
