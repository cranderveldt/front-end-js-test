var f = require('faker')

function random (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

module.exports = function () {
  var data = {
    appointments: [
      {
        id: 1,
        date: '2016-06-26T01:10:08.519Z',
        practitioner_id: 1,
        patient_id: 1
      }
    ],
    practitioners: [
      {
        id: 1,
        title: 'Dr.',
        first_name: 'Red',
        last_name: 'Guava'
      }
    ],
    patients: [
      {
        id: 1,
        first_name: 'Red',
        last_name: 'Guava'
      }
    ]
  }
  for (var i = 2; i < 500; i++) {
    var date = f.date.past()
    data.appointments.push({
      id: i,
      date: date,
      practitioner_id: random(1, 10),
      patient_id: random(1, 100)
    })
  }
  for (var i = 2; i < 101; i++) {
    data.patients.push({
      id: i,
      first_name: f.name.firstName(),
      last_name: f.name.lastName()
    })
  }
  for (var i = 2; i < 11; i++) {
    data.practitioners.push({
      id: i,
      title: 'Dr.',
      first_name: f.name.firstName(),
      last_name: f.name.lastName()
    })
  }
  return data
}
