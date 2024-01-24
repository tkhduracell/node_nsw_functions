README
===

## Certs

    openssl genrsa -out server.key 2048
    openssl req -new -key server.key -out server.csr
    openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

## Booking

curl 'https://europe-north1-nackswinget-af7ef.cloudfunctions.net/calendars-api/book' \
  --data-raw '{"title":"Test","location":"Ceylon","password":"XXX","date":"2024-01-23T23:00:00.000Z","time":"15:00","duration":60,"description":"Bob - 07026XXXXX"}'