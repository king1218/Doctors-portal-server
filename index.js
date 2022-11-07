
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rahsr.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
 
const verifyJWT = (req,res,next)=>{
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.status(401).send({massage: 'UnAthorized Access!!'});
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,function(err,decoded){
    if(err){
      return res.status(403).send({massage:'Forbidden Access'});
    }
    req.decoded= decoded;
    next();
  })
}

async function run(){
    try{
        await client.connect();
        const serviceCollection = client.db('Doctors-portal').collection('Service');
        const BookingCollection = client.db('Doctors-portal').collection('Booking');
        const UserCollection = client.db('Doctors-portal').collection('Users');


        app.get('/service', async(req, res) =>{
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })



        // ALL user:

        app.get('/user',verifyJWT, async(req,res)=>{
          
          const users =await UserCollection.find().toArray();
          res.send(users);
        })
        // admin or not:
        app.get('/user/:email',verifyJWT,async(req,res)=>{
          const email = req.params.email;
          const user=await UserCollection.findOne({ email: email});
          const isAdmin = user.role ==='admin'
          res.send({admin:isAdmin});
        })
        // admin role:
        app.put('/user/admin/:email',verifyJWT,async(req,res)=>{
          const email = req.params.email;
          const requester=req.decoded.email;
          const requesterAccount=await UserCollection.findOne({ email:requester });
          if(requesterAccount.role ==='admin' ){
            const filter = {email:email};
            const updateDoc ={
              $set:{role:'admin'},
            };
            const result = await UserCollection.updateOne(filter,updateDoc);
          
            res.send(result);

          }
          else{
            res.status(403).send({massage:'Forbidden Access'})
          }
         
        })
        // put user:
        app.put('/user/:email',async(req,res)=>{
          const email = req.params.email;
          const user = req.body;
          const filter = {email:email};
          const options = {upsert:true};
          const updateDoc ={
            $set:user,
          };
          const result = await UserCollection.updateOne(filter,updateDoc,options);
          const token = jwt.sign({email: email},process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
          res.send({result, accessToken: token});
        })

        // userwise booking:
      
        app.get('/booking',verifyJWT, async(req, res) =>{
          const patient = req.query.patient;
        
          const DecodedEmail = req.decoded.email;
          if(patient === DecodedEmail){
            const query = {patient: patient};
            const booking = await BookingCollection.find(query).toArray();
            res.send(booking);
          }
          else{
            return res.status(403).send({massage:'Forbidden Access'})
          }
          
        })
        app.post('/booking', async (req, res) => {
          const booking = req.body;
          const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
          const exists = await BookingCollection.findOne(query);
          if (exists) {
            return res.send({ success: false, booking: exists })
          }
          const result = await BookingCollection.insertOne(booking);
          return res.send({ success: true, result });
        })
        app.get('/available',async (req,res)=>{
          const date = req.query.date;
          const query = {date:date}
          const booking = await BookingCollection.find(query).toArray();

          const services = await serviceCollection.find().toArray();

          services.forEach(service=>{
            // step 4: find bookings for that service. output: [{}, {}, {}, {}]
            const serviceBookings = booking.filter(book => book.treatment === service.name);
            // step 5: select slots for the service Bookings: ['', '', '', '']
            const bookedSlots = serviceBookings.map(book => book.slot);
            // step 6: select those slots that are not in bookedSlots
            const available = service.slots.filter(slot => !bookedSlots.includes(slot));
            //step 7: set available to slots to make it easier 
            service.slots = available;
          });
            
          res.send(services);

        })

    }
    finally{

    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello From Doctor Uncle!')
})

app.listen(port, () => {
  console.log(`Doctors App listening on port ${port}`)
})