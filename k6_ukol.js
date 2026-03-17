//k6 run .\k6_ukol.js


import { sleep, check } from "k6";
import http from "k6/http";
import { Trend, Rate } from "k6/metrics";

//Všechny hodnoty v testu (konfigurace) musí být parametrizovatelný.
const config = {
  vus: 2, //Maximální zátěž je 2 VU
  duration: "5m", //TestCase poběží 5minut.

  baseUrl: "https://www.iwant.cz/",

  minPocetIphonu: 10,
  minPocetFilteru: 1000,
  vysledkyVyhledavani: 12,

  maxReqDuration: 1000, //Každý request musí být odbaven do 1000ms.
  maxSearchDuration: 1300, //Vyhledání iPhone nesmí trvat déle jak 1300ms
  maxProductDuration: 1500, //Stránka s detailem iPhone se zobrazí do 1500ms
};

//custom metriky
//Rate = procento úspěšných průchodů true/false
//custom metrika pro měření úspěšnosti celé user journey
const userJourneySuccess = new Rate("user_journey_success");
const searchResultsDuration = new Trend("search_results_duration");

export const options = {
  vus: config.vus,
  duration: config.duration,
  thresholds: {
    http_req_failed: ["rate==0"], //Ověřuj, že response nejsou chybové
    http_req_duration: [`p(95)<${config.maxReqDuration}`], //Každý request musí být odbaven do 1000ms.

    "http_req_duration{type:search}": [`p(95)<${config.maxSearchDuration}`],
    "http_req_duration{type:productDetail}": [`p(95)<${config.maxProductDuration}`],
    
    //custom metrika pro měření doby trvání vyhledávání výsledků
    search_results_duration: ["p(95)<1000"],

},
};

const baseUrl = config.baseUrl;

export default function () {
    //custom metrika pro měření úspěšnosti celé user journey
    let journeyOk = true;

  // Našeptávač musí vrátit více jako 10 iphonů.
  //r.body.match další způsob jak vyhledat string v response
  //const matches = r.body.match(/<div class="productList-item"/g);

  let naseptavac = http.get(
    `${baseUrl}Products/Fulltext/AutocompleteItems?query=iphone`,
    { tags: { type: "naseptavac" } }
  );

  let okNaseptavac = check(naseptavac, {
    "status je 200": (r) => r.status === 200,
    "Našeptávač musí vrátit více jako 10 iphonů": (r) =>
      (r.body.match(/Apple iPhone/g)).length > config.minPocetIphonu,
  });
    journeyOk = journeyOk && okNaseptavac;



  //Vyhledání iPhone nesmí trvat déle jak 1300ms, je v thresholds
  let vyhledani= http.get(
    `${baseUrl}Vyhledavani?query=iphone`,
    { tags: { type: "search" } }
  );

  let okVyhledani = check(vyhledani, {
    "status je 200": (r) => r.status === 200,
  });
  journeyOk = journeyOk && okVyhledani;



  //Číselník vrátí více jak 1000 filtrů.
  //r.json().length počítání položek v poli

  let filtry = http.get(
    `${baseUrl}Products/Filter/AllFilterData`,
    { tags: { type: "filtry" } }
  );

  let okFiltry = check(filtry, {
    "status je 200": (r) => r.status === 200,
    "Číselník vrátí více jak 1000 filtrů.": (r) =>
      r.json().length > config.minPocetFilteru,
  });
  journeyOk = journeyOk && okFiltry;


  //Výsledky vyhledávání zobrazí na stránce 12 iphonů. - trochu bych asi potřebovala lepší specifikaci. Jeslti je nutné aby zobrazila 12 iphonů, nebo jestli máme kontrolovat, že v query params je nastaveno 12?
  //https://grafana.com/docs/k6/latest/javascript-api/k6-html/element/element-selection/

  let vysledkyVyhledavani = http.get(
    `${baseUrl}Products/Fulltext/SearchResultItems?ftQuery=iphone&ctx=101&itId=&cg=2&paramJson=`,
    { tags: { type: "vysledkyVyhledavani" } }
  );

  searchResultsDuration.add(vysledkyVyhledavani.timings.duration);

  let okVysledkyVyhledavani = check(vysledkyVyhledavani, {
    "status je 200": (r) => r.status === 200,
    "12 iphonů na stránce": (r) =>
      r.html().find(".productList-item-title").size() === config.vysledkyVyhledavani,
  });
    journeyOk = journeyOk && okVysledkyVyhledavani;


  // stránkování - Funguje stránkování a vrací tlačítka pro přechod na další stránku.
  //r.body.includes vyhledávání v response body
  let buttonStrankovani = http.get(
    `${baseUrl}Products/Helper/Pager?totalCount=5366&pageSize=12&currentPage=1&allPages=false`,
    { tags: { type: "stránkování" } }
  );

  let okButtonStrankovani = check(buttonStrankovani, {
    "status je 200": (r) => r.status === 200,
    "existuje button pro strankovani": (r) =>
      r.body.includes('<button type="button" class="pager-next" data-page="2">'),
  });
  journeyOk = journeyOk && okButtonStrankovani;


  // Stránka s detailem iPhone se zobrazí do 1500ms - je v thresholds
  let detail = http.get(
    `${baseUrl}Apple-iPhone-15-128GB-ruzovy-p122081`,
    { tags: { type: "productDetail" } }
  );
  let okDetail = check(detail, {
    "status je 200": (r) => r.status === 200,
  });
  journeyOk = journeyOk && okDetail;


  userJourneySuccess.add(journeyOk);
  sleep(2);
}
