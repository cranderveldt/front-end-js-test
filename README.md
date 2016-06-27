# Trevor's notes

This was a really fun test, I enjoyed putting it together. I didn't realize how robust the API was at first, and part of my confusion was because of the column naming convention used in the api.js file. Appointments have `patient_id` and `practitioner_id` but if the column names are changed to `patientId` and `practitionerId`, then you can do relational queries, which help out in a couple of places.

Because of this I've changed the column names in api.js here on master, but I've kept my original solution using your given column names on the [no_relation_queries branch](https://github.com/cranderveldt/front-end-js-test/tree/no_relation_queries). The code on this branch uses two additional queries on appointment search, but if you wanted us to avoid relational queries, that's the branch to review. Otherwise you can stick to master.

# Front end test
You will build a small single page app that consumes a REST API for managing appointments.

There is a REST API server setup using [JSON server](https://github.com/typicode/json-server). Run `npm install && npm start`. You can see a JSON response at the endpoints: `/appointments`, `/practitioners`, and `/patients`.

## Pages
There are three pages: Patients, Practitioners, and Appointments. You do **not** need to set up a router. Just let the components load into the page as needed.

Mostly you'll only need to GET data for the page, but the **Patient** page also allows creating an appointment.

You can see static versions of the pages at `/patients.html`, `/practitioners.html`, and `/appointments.html`.

## Instant search
Each page has a search input. This should be _instant_ as you type but must follow some rules. The search request should be sent only if...

- the search string is longer than 2 characters
- there is more than 500ms since the last request
- the search value has changed

Clicking on a search result should remove the search result list, clear the search input, and load the details for that result into the page.

## Components
We are interested in seeing a **modular, component-based** approach to building the UI _and_ consuming the REST API. The markup on each page is written with components in mind (hint, hint).

It should run 100% on the client so it needs to be written in (or compile to) JavaScript. Feel free to use ES5, ES2015, CoffeeScript, or TypeScript.

We don't care what framework/approach you use but keep in mind that while this test is simple, Cliniko is big and complicated. In other words... your approach should scale.
