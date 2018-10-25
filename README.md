# Steganography 
It is the art or practice of concealing a message, image, or file
within another message, image, or file. A simple example of steganography in
the physical world is using invisible ink to conceal a secret message in a normal-
looking letter. A historical use was by a US POW blinking out a secret message
using Morse code when forced to participate in a propaganda video.


## Project Descriptions:
- Each Project folder has a seperate pdf file containing detailed project information and intructions to execute it.
- Below is summary for each project:

### Project 1 (Node.js & bit twiddling)
In this project, we will use bit-twiddling to conceal a string message within a
PPM image file. The inefficient PPM format was chosen over more popular and
practical formats like GIF or PNG as it is extremely simple to understand and
manipulate.
#### Aims:
- To get you to write a simple but non-trivial JavaScript program.
- To make you understand the representation of unsigned integers/characters and the use of bit twiddling.
- To allow you to familiarize yourself with the programming environment you will be using in this course.
- To introduce you to steganography.
#### It should be possible to run steg.js with upto two arguments:
- When invoked with zero arguments, steg.js should simply output a usage message on standard error.
- When invoked with one argument, steg.js should unhide the message concealed in the PPM file named by its first argument and print it on standard output followed by a newline character.
- When invoked with two arguments, steg.js should hide the message specified by its second argument in the PPM image file named by its first argument and write the contents of the resulting image on standard ouput.

### Project 2 (MongoDB & NPM)
This project requires you to implement an interface to a mongo database to
allow storing and retrieving images. An image is identified by two strings:
- group A non-empty string which does not contain any NUL characters.
- name A non-empty string which does not contain any NUL or / characters
An example identification for an image might have group inputs and name
rose. Since name cannot contain a / character, we can unambiguously use the
single string group/name to identify an image, for example inputs/rose.
#### Aims:
  - To familiarize you to asynchronous programming in JavaScript.
  - To expose you to using a package manager for JavaScript.
  - To provide you with some experience using a popular no-sql database.
#### It should be possible to install project by setting the current directory to its submit/prj2/img-store subdirectory and then running npm install:
- After the install, the submit/prj2/img-store should contain a index.js executable file which can be run with the sub-commands:
  - ./index.js get group name type Print on standard output the binary
type contents of the image previously stored in database under id group/name.
  - ./index.js list group Print on standard output the names of all the images
stored under group group, with each name being output on a separate line.

### Project 3 (REST, express.js & async/await)
This project requires you to implement web services which allow adding and
retrieving images from a database as well as using the stored images to perform
steganography:
An image is identified by two strings:
- group A non-empty string which does not contain any NUL characters.
- name A non-empty string which does not contain any NUL or / characters
An example identification for an image might have group inputs and name
rose. Since name cannot contain a / character, we can unambiguously use the
single string group/name to identify an image, for example inputs/rose.
#### Aims:
  - To implement some simple web services.
  - To expose you to using the express.js server framework.
  - To give you some more experience with asynchronous code.
#### It should be possible to install project by setting the current directory to its submit/prj3/steg-ws subdirectory and then running npm install:
- After the install, the submit/prj3/img-store should contain a index.js executable
file which when run will start a web server on the port specified by
its first command-line argument. This web server should support an underlying
database and should accept the following HTTP requests:
  - Image store service: POST /api/images/group
  - Image retrieval service: GET /api/images/group/name.type
  - Image meta-information service: GET /api/images/group/name/meta
  - Image list service: GET /api/images/group
  - Message hide service: POST /api/steg/group/name
  - Message unhide service: GET /api/steg/group/name

### Project 4 (mustache & web-services)
This project requires you to implement web services which allow adding and
retrieving images from a database as well as using the stored images to perform
steganography:
An image is identified by two strings:
- group A non-empty string which does not contain any NUL characters.
- name A non-empty string which does not contain any NUL or / characters
An example identification for an image might have group inputs and name
rose. Since name cannot contain a / character, we can unambiguously use the
single string group/name to identify an image, for example inputs/rose.
#### Aims:
  - To develop a web project given a blank slate without any existing code.
  - To use web services.
  - To generate HTML pages using server-side templating (mustache).
#### It should be possible to install project by setting the current directory to its submit/prj4/steg subdirectory and then running npm install:
- After the install, the submit/prj4/steg should contain a index.js executable
file which must start a web server. It must be run using two command-line
arguments:
  - PORT This first command-line argument should specify the port number on
which the web server listens for incoming HTTP requests.
  - WS-URL This second command-line argument should specify the base url
(of the form http://domain:port) of a web server providing the web
services specified for your previous project.
  - Home Page at URL /index.html This should contain links to the Hide and
Unhide pages specified below.
  - Hide Page This should display a form which allows the user to:
    - Select exactly one image from all the images in the inputs image
group from WS-URL web service. The images should be displayed
as thumbnails having their original aspect ratio but having a width
of 100 pixels. Each image should also be displayed with some kind
of distinct name.
    - Specify a message to be hidden
  - Hide Success Page This page should display the name of the image created
in the steg group containing the hidden message. It should also contain
links to the hide and unhide pages.
  - Unhide Page This should display a form which allows the user to:
    - Select exactly one image from all the images in the steg image
group from WS-URL web service. The images should be displayed
as thumbnails having their original aspect ratio but having a width
of 100 pixels. Each image should also be displayed with a distinct
ID.
  - Unhide Success Page This page should display the contents of the recovered
message after a successful unhide request. It should also contain links to
the hide and unhide pages.

##      Thats All Folks !!    
