//-*- mode: rjsx-mode;

'use strict';

(function() {

  /************************* Utility Functions **************************/

  /** Return url passed via ws-url query parameter to this script */
  function getWsUrl() {
    const params = (new URL(document.location)).searchParams;
    return params.get('ws-url');
  }


  /** Return contents of file (of type File) read from user's computer */
  async function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>  resolve(reader.result);
      reader.readAsText(file);
    });
  }

  /** Return short labels which are prefix of names, ensure unique */
  function makeLabels(names) {
    const MAX_PREFIX_LEN = 8;
    const labels = {};
    const seen = {};
    names.forEach((name) => {
      const m = name.match(/^(.{1,8})\W/);
      const base = m ? m[1] : name.substr(0, MAX_PREFIX_LEN);
      let [label, i] = [base, 1];
      while (seen[label]) label = base + i++;
      labels[name] = seen[label] = label;
    });
    return labels;
  }

  async function getImagesInfo(group, ws) {
    const names = await ws.list(group);
    const groupBaseUrl = ws.getImagesUrl(group);
    const labels = makeLabels(names);
    return names.map((name) => ({
      name: name,
      url: `${groupBaseUrl}/${name}.png`,
      label: labels[name],
    }));
  }



  /************************* Web Service Layer *************************/
  const DEFAULT_WS_URL = 'http://server:1234';

  const WS_URL = getWsUrl() || DEFAULT_WS_URL;

  class StegWs {

    constructor() {
      this.baseUrl = WS_URL;
      this.apiUrl = `${this.baseUrl}/api`;
    }

    getImagesUrl(group) {
      return `${this.apiUrl}/images/${group}`;
    }

    async list(group) {
      try {
        const url = `${this.apiUrl}/images/${group}`;
        const response = await axios.get(url);
        return response.data;
      }
      catch (err) {
        throw (err.response.data) ? err.response.data : err;
      }
    };

    async hide(srcGroup, srcName, outGroup, msg) {
      try {
        const url = `${this.apiUrl}/steg/${srcGroup}/${srcName}`;
        const params = { outGroup: outGroup, msg: msg, };
        const response = await axios.post(url, params);
        /* to get location header it will need to be enabled in CORS.
        const location = response.headers['location'];
        const match = location && location.match(/[^\/]+\/[^\/]+$/);
        if (!location || !match) {
          const err = 'cannot get hide image location';
          throw err;
        }
        else {
          return match[0];
        }
        */
      }
      catch (err) {
        console.error(err);
        throw (err.response && err.response.data) ? err.response.data : err;
      }
    };

    async unhide(group, name) {
      try {
        const url = `${this.apiUrl}/steg/${group}/${name}`;
        const response = await axios.get(url);
        return response.data.msg;
      }
      catch (err) {
        throw (err.response.data) ? err.response.data : err;
      }
    };

  } //StegWs

  /************************** Image Component **************************/

  function Image(props) {
    const {url, name, label, onChange, checked} = props;
    return (
      <div className="image">
        <img src={url} alt={name}/><br/>
        <input name="img" type="radio" value={name} checked={checked}
               onChange={onChange}/>
        {label}
      </div>
    );
  }




  /*************************** Hide Component **************************/

  const HIDE_GROUP = 'inputs';

  class Hide extends React.Component {

    constructor(props) {
      super(props);
      this.setSelectedImage = this.setSelectedImage.bind(this);
      this.setMessage = this.setMessage.bind(this);
      this.setFile = this.setFile.bind(this);
      this.useFile = this.useFile.bind(this);
      this.onSubmit = this.onSubmit.bind(this);
      this.state = {
        selectedName: undefined,
        message: undefined,
        file: undefined,
        errors: [],
        imagesInfo: [],
        doFile: true,
      };
    }


    async componentDidMount() {
      try {
        const imagesInfo = await getImagesInfo(HIDE_GROUP, this.props.ws);
        this.setState({imagesInfo: imagesInfo});
      }
      catch (err) {
        const msg = (err.message) ? err.message : 'web service error';
        this.setState({errors: [msg]});
      }
    }

    setSelectedImage(event) {
      const name = event.target.value;
      this.setState({selectedName: name, errors: [], file: undefined});
    }

    setMessage(event) {
      const message = event.target.value;
      this.setState({message: message});
    }

    async setFile(event) {
      this.setState({file: event.target.files[0]});
    }

    useFile(event) {
      this.setState({doFile: event.target.checked});
    }

    async onSubmit(event) {
      event.preventDefault();
      const [msg, name] = await this.validate();
      if (msg && name) {
        try {
          await this.props.ws.hide(HIDE_GROUP, name, UNHIDE_GROUP, msg);
          this.props.app.select('unhide', 'true');
        }
        catch (err) {
          const msg = err.message || 'web service error';
          this.setState({errors: [msg]});
        }
      }
    }

    async validate() {
      const errors = [];
      const msg =
        (this.state.doFile)
        ? this.state.file && await readFile(this.state.file)
        : this.state.message;
      if (!msg) errors.push('A message must be specified');
      const name = this.state.selectedName;
      if (!name) errors.push('A image must be selected');
      if (errors.length > 0) {
        this.setState({errors: errors});
        return [];
      }
      else {
        return [msg, name];
      }
    }

    render() {
      return this.state.imagesInfo.map((info, i) => {
        const {message, selectedName, doFile} = this.state;
        const checked = (selectedName === info.name);
        const showForm = checked ? 'show' : 'hide';
        const showFile = (doFile) ? 'show' : 'hide';
        const showTextbox = (doFile) ? 'hide' : 'show';
        const errors = this.state.errors.map((e, i) => {
          return <li className="error" key={i}>{e}</li>;
        });
        return (
          <form onSubmit={this.onSubmit} key={i}>
            <Image {...info}  checked={checked}
                   onChange={this.setSelectedImage}/>
            <div className={showForm}>
              <input type="checkbox" checked={doFile} id={`doFile${i}`}
                     onChange={this.useFile}/>
              <label htmlFor={`doFile${i}`}>Upload message from file:</label>
              <div className={showFile}>
                <label htmlFor={`file${i}`}>Choose file:</label>
                <input type="file" onChange={this.setFile} id={`file${i}`}/>
              </div>
              <div className={showTextbox}>
                <label htmlFor={`text${i}`}>Enter message:</label><br/>
                <textarea name="message" value={message} id={`text${i}`}
                          rows="10" cols="80" onChange={this.setMessage}/>
              </div>
              <ul>{errors}</ul>
              <input type="submit" value="Hide"/>
            </div>
          </form>
        );
      });
    }

  }

  /************************** Unhide Component *************************/

  const UNHIDE_GROUP = 'steg';

  class Unhide extends React.Component {

    constructor(props) {
      super(props);
      this.onChange = this.onChange.bind(this);
      this.state = {
        selectedName: undefined,
        message: undefined,
        imagesInfo: [],
        errors: [],
      };
    }


    async componentDidMount() {
      try {
        const imagesInfo = await getImagesInfo(UNHIDE_GROUP, this.props.ws);
        this.setState({imagesInfo: imagesInfo});
        if (this.props.preselect) {
          const name = imagesInfo[imagesInfo.length - 1].name;
          const message = await this.props.ws.unhide(UNHIDE_GROUP, name);
          this.setState({message: message, selectedName: name});
        }
      }
      catch (err) {
        const msg = (err.message) || 'web service error';
        this.setState({errors: [msg]});
      }
    }

    async onChange(event) {
      const name = event.target.value;
      this.selectedName = name;
      try {
        const message = await this.props.ws.unhide(UNHIDE_GROUP, name);
        this.setState({message: message, selectedName: name, errors: []});
      }
      catch (err) {
        const msg = (err.message) || 'web service error';
        this.setState({errors: [msg]});
      }
    }

    render() {
      return this.state.imagesInfo.map((info, i) => {
        const onChange = this.onChange;
        const selectedName = this.state.selectedName;
        const checked = (info.name === selectedName);
        const errors = !checked ? [] : this.state.errors.map((e, i) => {
          return <li className="error" key={i}>{e}</li>;
        });
        const message = checked ? this.state.message : '';
        return (
          <div key={i}>
            <Image {...info} checked={checked} onChange={onChange}/>
            <ul>{errors}</ul>
            <pre className="message">{message}</pre>
          </div>
        );
      });
    }

  }




  /*************************** Tab Component ***************************/

  function Tab(props) {
    const id = props.id;
    const tabbedId = `tabbed${props.index}`;
    const checked = (props.index === 0);
    return (
      <section className="tab">
        <input type="radio" name="tab" className="tab-control"
               id={tabbedId} checked={props.isSelected}
               onChange={() => props.select(id)}/>
        <h1 className="tab-title">
          <label htmlFor={tabbedId}>{props.label}</label>
        </h1>
        <div className="tab-content" id={props.id}>
          {props.component}
        </div>
      </section>
    );
  }

  /*************************** App Component ***************************/

  class App extends React.Component {

    constructor(props) {
      super(props);

      this.select = this.select.bind(this);
      this.isSelected = this.isSelected.bind(this);

      this.state = {
        selected: 'hide',
        hide: <Hide ws={props.ws} app={this}/>,
        unhide: <Unhide ws={props.ws} app={this}/>
      };

    }

    //top-level error reporting; produces slightly better errors
    //in chrome console.
    componentDidCatch(error, info) {
      console.error(error, info);
    }

    isSelected(v) { return v === this.state.selected; }

    select(v, preselect=undefined) {
      this.setState({selected: v});
      const rand = Math.random();  //random key to force remount; not performant
      let component;
      switch (v) {
        case 'hide':
          component = <Hide ws={this.props.ws} app={this} key={rand}/>;
        break;
        case 'unhide':
        component = (
          <Unhide ws={this.props.ws} app={this}
                  preselect={preselect} key={rand}/>
        );
        break;
      }
      this.setState({ [v]: component });
    }

    render() {
      const tabs = ['hide', 'unhide'].map((k, i) => {
        const component = this.state[k];
        const label = k[0].toUpperCase() + k.substr(1);
        const isSelected = (this.state.selected === k);
        const tab = (
          <Tab component={component} key={k} id={k}
               label={label} index={i}
               select={this.select} isSelected={isSelected}/>
        );
        return tab;
      });

      return <div className="tabs">{tabs}</div>
    }

  }

  /*************************** Top-Level Code **************************/

  function main() {
    const ws = new StegWs();
    const app = <App ws={ws}/>;
    ReactDOM.render(app, document.getElementById('app'));
  }

  main();

})();
