import './navbar.css'
import Badge from '../Badge/Badge.tsx'

function Navbar () {

    return (
        <>
         <nav className="navbar navbar-expand-lg bg-body-tertiary">
          <div className="container-fluid align-items-center">
            <a className="navbar-brand" href="#" style = {{marginRight: '2rem'}}><h1 className = 'gulams-heading'>UBet</h1></a>


            <div className = "d-flex align-items-center ms-auto" style = {{padding: '1.5srem'}}>

              <div className = "ms-2" style = {{marginRight: '1rem'}}>
                <Badge>Notifications</Badge>
              </div>

              <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span className="navbar-toggler-icon"></span>
              </button>
            </div>

            <div className="collapse navbar-collapse" id="navbarNav">
              <ul className="navbar-nav">
                <li className="nav-item">
                  <a className="nav-link" href="#">Leaderboard</a>
                </li>
                <li className="nav-item">
                  <a className="nav-link" href="#">Friends</a>
                </li>
              </ul>
            </div>
          </div>
        </nav>
        </>
    )

}


export default Navbar