LET US WORK ON A NEW RAILS REACT APP WITH JWT AUTHENTICATION
`rails new react-rails-auth --api `
`cd react-rails-auth`
We need to add a few gems that are required for the authentication.
Add this code to your gemfile
`gem "bcrypt" gem "rack-cors" gem "active_model_serializers" gem "jwt"`
Install these gems with 
`bundle i`
Let's navigate config/initializers/cors.rb and uncomment the lines below. Make sure to add \* on the origins so that it can accept requests from any domain.

# in config/initializers/cors.rb

`Rails.application.config.middleware.insert_before 0, Rack::Cors do
allow do
origins "\*"

    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head]

end
end`

Let's now create our user model , we use password_digest instead of password so we can encrypt the password
`rails g model User username password_digest email`
We will then create a controller as shown below , we use api/v1/ to version our endpoints
`rails g controller api/v1/users`
Let's add a user serializer to serialize our api and choose what we want displayed on our endpoints

`rails g serializer user`
We can now do the migrations to generate the schema ,
`rails db:migrate`
In ruby, we have macros(class methods that generate instance methods). We will need to use the has_secure_password macros to make sure that the password is hashed using the bcrypt gem .
Add has_secure_password to app/models/user.rb as shown below

# app/models/user.rb

`class User < ApplicationRecord has_secure_password end`

First , we code a create action in the users controller that will allow for signing up .The create action will be used to create a new user.
Add this to the user's controller in api/v1/users_controller.rb

`def create
user = User.new(user_params)
if user.save
render json: user
else
render json: {error: "Error creating user"}
end
end

private
def user_params
params.require(:user).permit(:username, :email, :password)
end`

In the user serializer , change the attributes to be displayed . So you can only see the email and the username .

`class UserSerializer < ActiveModel::Serializer attributes :username, :email end`

Finally , we add a route for our creat action , This will be done in the config/routes.rb . Add this code inside the routes.rb

`namespace :api do namespace :v1 do resources :users, only: [:create] end end`

Now, let us test this out with postman.
Start up your server with
`rails s`
Open up Postman and send a Post Request to this endpoint
`http://localhost:3000/api/v1/users`
The body of the Json will be

`{ "user": { "username":"test", "email":"test@gmail.com", "password": "password" } }`

If you do this right , you will get a response of the created user
`{ "username": "test", "email": "test@gmail.com" }`

Now essentially , we would want the email to be unique so a user can have only one account , we can add this validation to the users model in
app/models/user.rb
` validates :email, uniqueness: true`

Now if we try to create a new user with the email test@gmail.com , we will get an error , Let's try that out
We get this as the response , we are good to go

`{ "error": "Error creating user" }`

We now want to get a token everytime we signup , To do this , we add an encode_token method to the application controller
` def encode_token(payload) JWT.encode(payload, 'my_s3cr3t') end`

We now modify our create action to give us a token everytime we sign up a user

`def create user = User.new(user_params) if user.save token = encode_token({user_id: user.id}) render json: {user: UserSerializer.new(user), token: token} else render json: {error: "Error creating user"} end end`

Now let us simulate signing up a user with postman by sending a POST request to the api/v1/users endpoint
`http://localhost:3000/api/v1/users`
and the body below
` { "user":{ "username":"test2", "email":"test2@gmail.com", "password":"password" } }`

now whenever we sign up and create a new user we will get this as the response body

`{ "user": { "username": "test2", "email": "test2@gmail.com" }, "token": "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjo0fQ.oFQeWUjCQx5X2vxlAH_bzAKijAkSbiS2hW9-EQS883o" }`

We will use this token to get the logged in user once a user signs up.To do so , Let's get the token from our header in the user's controller so that we can use it to get the current user. We then have to decode the token which can be used to find the user from the database. We then create a current user method to find the current user.
Modify your application controller to look like this

`class ApplicationController < ActionController::API
before_action :authorized
def encode_token(payload)
JWT.encode(payload, 'my_s3cr3t')
end
def auth_header # { Authorization: 'Bearer <token' }
request.headers['Authorization']
end

    def decoded_token
        if auth_header
            token = auth_header.split(' ')[1]
            begin
                JWT.decode(token, 'my_s3cr3t', true, algorithm: 'HS256')
            rescue
                nil
            end
        end

    end

    def current_user
        if decoded_token
            user_id = decoded_token[0]['user_id']
            @user = User.find_by(id: user_id)
        end
    end

    def logged_in?
        !!current_user
    end

    def authorized
        if logged_in?
            true
        else
            render json: { message: 'Please log in' }, status: :unauthorized
        end
    end

end`

With this , we now need to create an action and a route that will Provide us with details on the logged in /signed up current user . This is where the jwt token comes in to play .

First , in our users controller create a profile method that will return a user

# path: app/controllers/api/v1/users_controller.rb

` def profile render json: { user: UserSerializer.new(current_user) }, status: :accepted end`

Also add this line at the top of your users controller

` skip_before_action :authorized, only: [:create]`

Your users controller should now look like this

`class Api::V1::UsersController < ApplicationController
skip_before_action :authorized, only: [:create]
def create
user = User.new(user_params)
if user.save
token = encode_token({user_id: user.id})
render json: {user: UserSerializer.new(user), token: token}
else
render json: {error: "Error creating user"}
end
end
def profile
render json: { user: UserSerializer.new(current_user) }, status: :accepted
end

    private
    def user_params
        params.require(:user).permit(:username, :email, :password)
    end

end`

We need to create a route for this , inside the routes.rb file , modify it to look like this

`Rails.application.routes.draw do

# config/routes.rb

namespace :api do
namespace :v1 do
resources :users, only: [:create]
get '/profile', to: 'users#profile'
end
end
end`

Now let us see how we will use this jwt token to get the current user .
We will get this token from the response header after signing up and use it in the header of the GET request to the /api/v1/profile endpoint to get the current user .
First, let us sign up a new user , send a POST REQUEST to the endpoint below

` http://localhost:3000/api/v1/users`

with the following body
`{ "user":{ "username":"test3", "email":"test3@gmail.com", "password":"password" } }`

We will get the following in the response body

`{ "user": { "username": "test3", "email": "test3@gmail.com" }, "token": "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjo1fQ.Oo2CYiJr2SrNc8DVm_DNnMHzTm0j4ACjzg_s5JqogTQ" }`

Now we need to copy the token .
Send a GET request to the following endpoint to get details on the signed up user
`http://localhost:3000/api/v1/profile`
On the headers for the request add one for Authorization , and add the keyword Bearer , followed by the token you got upon signing up
The Authorization Header should look like this
`Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjo1fQ.Oo2CYiJr2SrNc8DVm_DNnMHzTm0j4ACjzgs5JqogTQ`
We will get this as the response body 
`{ "user": { "username": "test3", "email": "test3@gmail.com" } }`
We are now getting Close .

We now need to create actions and routes for login in to an existing account 
First ,Let's create the auth controller.
Create an auth_controller.rb file in api/v1 directory.
We need to add the create method for the login

Add this code inside the auth_controller.rb file
`class Api::V1::AuthController < ApplicationController
skip_before_action :authorized, only: [:create]

    def create
        @user = User.find_by(username: login_params[:username])
        if @user && @user.authenticate(login_params[:password])
            token = encode_token(user_id: @user.id)
            render json: { user: UserSerializer.new(@user), jwt: token }, status: :accepted
        else
            render json: { error: 'Invalid username or password' }, status: :unauthorized
        end
    end

    private

    def login_params
        params.require(:user).permit(:username, :password)
    end

end`

Go to your routes and modify them to look like this , we are adding the login route to the auth#create action

`Rails.application.routes.draw do

# config/routes.rb

namespace :api do
namespace :v1 do
resources :users, only: [:create]
post '/login', to: 'auth#create'
get '/profile', to: 'users#profile'
end
end
end`

If we simulate the request on postman with the endpoint below
`http://localhost:3000/api/v1/login`
and the body below

`{ "user":{ "username":"test4", "password":"password" } }`

We get this as the response body

`{ "user": { "username": "test4", "email": "test4@gmail.com" }, "jwt": "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjo2fQ.vtpfTKvkUI8PlzoDVeEH8AWrT7nrdxQSsByE50vBkeY" }`

We can now use this profile to get the current user by sending a GET request to /api/v1/profile with this token in the Authorization header to get the current user.

THE BACKEND IS FINALLY DONE
We will use React Js for the frontend .
To have react in your rails app , run this command

`npx create-react-app client`

This will create a react app in your rails app inside a folder called client
Let's also update the "start" script in the the package.json file to specify a different port to run our React app in development:

`"scripts": { "start": "PORT=4000 react-scripts start" }`

With that set up, let's try running our servers! In your terminal, run Rails:

`rails s`

Then, open a new terminal, and run React:

`npm start --prefix client`

We can simplify this process of making requests to the correct port by using create-react-app in development to proxy the requests to our API .This will let us write our network requests like this:
fetch("/movies");
// instead of fetch("http://localhost:3000/movies")
To set up this proxy feature, open the package.json file in the client directory and add this line at the top level of the JSON object:

`"proxy": "http://localhost:3000" `

Let us add react-router dom

Change directory to the client folder and run

`cd client`
`npm i react-router-dom`
Create a new SignUp component and add this code .
This is a form that sends a POST request to /api/v1/users and signs up a new user , We then store this in a state that is passed down from The App.js

SignUp.js
`import { useState } from "react";
import { Link } from "react-router-dom";
function SignUp({ setStoredToken }) {
const [username, setUsername] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const handleSubmit = (e) => {
e.preventDefault();

    fetch("/api/v1/users", {
      method: "POST",
      headers: {
        Accepts: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user: {
          username,
          email,
          password,
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        localStorage.setItem("token", data.token);
        console.log(data);
        setStoredToken(data.token);
      });

    setUsername("");
    setEmail("");
    setPassword("");

};
return (
<div className="App">
<h1>Create new user</h1>
<form>
<label>
Username:
<input
type="text"
name="name"
value={username}
onChange={(e) => setUsername(e.target.value)}
/>
</label>
<label>
Email:
<input
type="text"
name="email"
value={email}
onChange={(e) => setEmail(e.target.value)}
/>
</label>
<label>
Password:
<input
type="text"
name="password"
value={password}
onChange={(e) => setPassword(e.target.value)}
/>
</label>
<button onClick={handleSubmit}>Submit</button>
</form>
<p>Already have an account?</p>
<Link to="/login">Login</Link>
</div>
);
}

export default SignUp;`

Now let us also make a Login component
Login.js
`import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login({ setStoredToken }) {
const [username, setUsername] = useState("");
const navigate = useNavigate();
const [password, setPassword] = useState("");
const handleSubmit = (e) => {
e.preventDefault();

    fetch("/api/v1/login", {
      method: "POST",
      headers: {
        Accepts: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user: {
          username,
          password,
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.jwt) {
          localStorage.setItem("token", data.token);
          setStoredToken(data.token);
          navigate("/");
        } else {
          alert("Invalid credentials");
        }
      });

    setUsername("");

    setPassword("");

};
return (
<div className="App">
<h1>Create new user</h1>
<form>
<label>
Username:
<input
type="text"
name="name"
value={username}
onChange={(e) => setUsername(e.target.value)}
/>
</label>

        <label>
          Password:
          <input
            type="text"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button onClick={handleSubmit}>Submit</button>
      </form>
    </div>

);
}

export default Login;`

Now let's have a page that displays after a user has logged in or signed up.
We will call it Hello.js , here we will have a Simple hello followed by the name of the current user .
Hello.js
`import React, { useEffect, useState } from "react";

function Hello({ setStoredToken }) {
const [name, setName] = useState("");
useEffect(() => {
fetch("/api/v1/profile ", {
method: "GET",
headers: {
Accepts: "application/json",
"Content-Type": "application/json",
Authorization: `Bearer ${localStorage.token}`,
},
})
.then((res) => res.json())
.then((data) => setName(data.user.username));
}, []);

return (
<div>
Hello {name}
<button
onClick={() => {
localStorage.setItem("token", null);
setStoredToken(null);
}} >
Log out
</button>
</div>
);
}

export default Hello;`

The way we handle logging out , we simply clear the local storage . in the App.js , we have set a conditional that will check whether the Local Storage is present , it displays different pages as shown below .
`
import React, { useState, useEffect } from "react";
import SignUp from "./SignUp";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Hello from "./Hello";
import Login from "./Login";

function App() {
const [storedToken, setStoredToken] = useState(localStorage.getItem("token"));
useEffect(() => {
console.log(storedToken);
}, [storedToken]);

return (
<div>
<Router>
<Routes>
{storedToken ? (
<Route
path="/"
element={<Hello setStoredToken={setStoredToken} />}
/>
) : (
<Route
path="/"
element={<SignUp setStoredToken={setStoredToken} />}
/>
)}
<Route
path="/login"
element={<Login setStoredToken={setStoredToken} />}
/>
</Routes>
</Router>
</div>
);
}

export default App;`
