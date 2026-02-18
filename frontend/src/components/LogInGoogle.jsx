
import { GoogleLogin } from "@react-oauth/google";
export default function LogInGoogle() {
    return (
        <div className="google-login">
            <GoogleButton onClick={() => console.log('Google button clicked')} />
        </div>
    );
}

