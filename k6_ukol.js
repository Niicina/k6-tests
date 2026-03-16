import { sleep, check } from "k6";
import http from "k6/http";

export const options = {
  vus: 2, //Maximální zátěž je 2 VU
  duration: "30s", //TestCase poběží 5minut.
  thresholds: {
    http_req_failed: ["rate==0"], //Ověřuj, že response vrací správné response codes.
    http_req_duration: ["p(95)<1000"], //Každý request musí být odbaven do 1000ms.


    "http_req_duration{type:search}": ["p(95)<1300"],
    "http_req_duration{type:productDetail}": ["p(95)<1500"],

  },
};

const baseUrl = "https://www.iwant.cz/";

export default function () {

  // Našeptávač musí vrátit více jako 10 iphonů.
  //r.body.match další způsob jak vyhledat string v response
  //const matches = r.body.match(/<div class="productList-item"/g);

  let naseptavac = http.get(
    `${baseUrl}Products/Fulltext/AutocompleteItems?query=iphone`,
    { tags: { type: "naseptavac" } }
  );

  check(naseptavac, {
    "Našeptávač musí vrátit více jako 10 iphonů": (r) =>(r.body.match(/Apple iPhone/g)).length > 9,
  });


  //Vyhledání iPhone nesmí trvat déle jak 1300ms, je v thresholds
  http.get(`${baseUrl}Vyhledavani?query=iphone`,
  {tags: {type: "search"}}
  );



//Číselník vrátí více jak 1000 filtrů.
//r.json().length počítání položek v poli

  let filtry = http.get(
    `${baseUrl}Products/Filter/AllFilterData`,
    { tags: { type: "filtry" } }
  );

  check(filtry, {
    "Číselník vrátí více jak 1000 filtrů.": (r) => r.json().length > 1000,
  });


//Výsledky vyhledávání zobrazí na stránce 12 iphonů. - trochu bych asi potřbovala lepší specifikaci. Jeslti je nutné aby zobrazila 12 iphonů, nebo jestli máme kontrolovat, že v quey params je nastaveno 12?
//https://grafana.com/docs/k6/latest/javascript-api/k6-html/element/element-selection/  

let results = http.get(
    `${baseUrl}Products/Fulltext/SearchResultItems?ftQuery=iphone&ctx=101&itId=&cg=2&paramJson=`,
    { tags: { type: "searchResults" } }
  );

  check(results, {
    "12 iphonů na stránce": (r) => r.html().find(".productList-item-title").size() === 12,
  });


  // stránkování
  //r.body.includes vyhledávání v response body
  let buttonStrankovani = http.get(
    `${baseUrl}Products/Helper/Pager?totalCount=5366&pageSize=12&currentPage=1&allPages=false`,
    { tags: { type: "stránkování" } }
  );

  check(buttonStrankovani, {
    "existuje button pro strankovani": (r) => r.body.includes('<button type="button" class="pager-next" data-page="2">')
  });


  // Stránka s detailem iPhone se zobrazí do 1500ms - je v thresholds
 http.get(`${baseUrl}Apple-iPhone-15-128GB-ruzovy-p122081`,
    { tags: { type: "productDetail" } }
  );

  sleep(2);
}