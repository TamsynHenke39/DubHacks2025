import type { ReactNode } from "react";

interface Props{
    children?: String;
}

function Badge({children} : Props) {

    return (
        <>
        <button type="button" className="btn btn-primary position-relative">
        {children}
        <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
            1
            <span className="visually-hidden">unread messages</span>
        </span>
    </button>
        </>
    )


}

export default Badge;