/**
 * Marvel Movies Home Work
 * 
 * How to run
 * k6 run demos/02-examples/movies-performance-test.js
 * 
 * INDEX=movie2 k6 run demos/02-examples/movies-performance-test.js
 * 
 */
import { sleep } from 'k6';
import { Counter } from 'k6/metrics';

const credentials = {
  user: __ENV.USER ? __ENV.USER : 'defaultUser',
  pass: __ENV.PASS ? __ENV.PASS : 'defaultPass',
};
// fragments
import {deleteIndex, saveMovies, existMovies} from './fragments/elasticsearch.js'
import {moviesData} from './fragments/movies-data.js'
import {reviewsData} from './fragments/reviews-data.js'
import { saveMovieRatings } from './fragments/elasticsearch.js'

//Použijte countery pro počítadlo chyb, test by měl mít threshold na počet úspěšně uložených filmů. 
export const errorCounter = new Counter('errors');
export const successMovies = new Counter('success_movies');

const config = {
  elasticsearch: {
    index: __ENV.INDEX ? __ENV.INDEX : 'movies',
    host: __ENV.HOST ? __ENV.HOST : 'http://localhost:9200',
  },
}

export const options = {
  scenarios: {
    movies: {
      //do elasticsearch se bude zapisovat v peaku maximálně 50 filmů za minutu.
    executor: 'constant-arrival-rate',
    rate: 50,          // 50 iterací
    timeUnit: '1m',    // za minutu
    duration: '5m',    //- TestCase poběží 5minut.
    preAllocatedVUs: 5, // nebylo řečeno
    exec: 'default',
    },

    //dotaz k tomuhle, musí se to dělat přes scénáře, nebo můžu mít všechny tři skupiny v default funkci a nastavit thresholdy pro všechny tři skupiny?
    reviews : {
      //Ke každému filmu veřejnost přidávat hodnocení, maximálně 100 hodnocení za minutu
      executor: 'constant-arrival-rate',
      rate: 100, // 100 iterací 
      timeUnit: '1m',    // za minutu
      preAllocatedVUs: 5, // nebylo řečeno
      //- TestCase poběží 5minut.
      duration: '5m',
      exec: 'reviewsScenario',
  },
  },

  thresholds: {
    //během testu se musí uložit alespoň 4 filmy
    'success_movies': ['count>=4'], 
    //- Obecně chceme aby REST-API Elasticsearch odpovídal vždy maximálně do 200ms.
      http_req_duration: ['p(95)<200'],
      //- Chybovost maximálně 1%
      http_req_failed: ['rate<0.01'],

        'http_req_duration{type:movie}': ['p(95)<200'],
        'http_req_duration{type:review}': ['p(95)<200'],

       'http_req_failed{type:movie}': ['rate<0.01'],
      'http_req_failed{type:review}': ['rate<0.01'],
  },
};

export function setup() {
  console.log('Config', config)
  deleteIndex(config)
}


export default function () {
  saveMovies(config, moviesData)

  sleep(5)
  existMovies(config, '4')

  //saveMovieRatings(config, reviewsData)
}

export function reviewsScenario() {
  saveMovieRatings(config, reviewsData)
}