import { useSearchParams } from 'react-router-dom'
import ViewProfile from './ViewProfile'
import EditProfile from './EditProfile'

export default function Profile() {
    const [params] = useSearchParams()
    const isEdit = params.get('edit') === '1'

    return (
        <div className="container py-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2>Mon profil</h2>
            </div>
            {isEdit ? <EditProfile /> : <ViewProfile />}
        </div>
    )
}
