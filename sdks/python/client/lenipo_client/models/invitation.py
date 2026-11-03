from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_role import ProjectRole
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.invitation_invited_by_type_0 import InvitationInvitedByType0
  from ..models.invitation_project_type_0 import InvitationProjectType0





T = TypeVar("T", bound="Invitation")



@_attrs_define
class Invitation:
    """ 
        Attributes:
            id (UUID):
            email (str):
            project (InvitationProjectType0 | None):
            role (None | ProjectRole):
            invited_by (InvitationInvitedByType0 | None):
            created_at (datetime.datetime):
            expires_at (datetime.datetime):
            accepted_at (datetime.datetime | None):
            revoked_at (datetime.datetime | None):
     """

    id: UUID
    email: str
    project: InvitationProjectType0 | None
    role: None | ProjectRole
    invited_by: InvitationInvitedByType0 | None
    created_at: datetime.datetime
    expires_at: datetime.datetime
    accepted_at: datetime.datetime | None
    revoked_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.invitation_invited_by_type_0 import InvitationInvitedByType0 # noqa: PLC0415
        from ..models.invitation_project_type_0 import InvitationProjectType0 # noqa: PLC0415
        id = str(self.id)

        email = self.email

        project: dict[str, Any] | None
        if isinstance(self.project, InvitationProjectType0):
            project = self.project.to_dict()
        else:
            project = self.project

        role: None | str
        if isinstance(self.role, ProjectRole):
            role = self.role.value
        else:
            role = self.role

        invited_by: dict[str, Any] | None
        if isinstance(self.invited_by, InvitationInvitedByType0):
            invited_by = self.invited_by.to_dict()
        else:
            invited_by = self.invited_by

        created_at = self.created_at.isoformat()

        expires_at = self.expires_at.isoformat()

        accepted_at: None | str
        if isinstance(self.accepted_at, datetime.datetime):
            accepted_at = self.accepted_at.isoformat()
        else:
            accepted_at = self.accepted_at

        revoked_at: None | str
        if isinstance(self.revoked_at, datetime.datetime):
            revoked_at = self.revoked_at.isoformat()
        else:
            revoked_at = self.revoked_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "email": email,
            "project": project,
            "role": role,
            "invitedBy": invited_by,
            "createdAt": created_at,
            "expiresAt": expires_at,
            "acceptedAt": accepted_at,
            "revokedAt": revoked_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.invitation_invited_by_type_0 import InvitationInvitedByType0 # noqa: PLC0415
        from ..models.invitation_project_type_0 import InvitationProjectType0 # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        email = d.pop("email")

        def _parse_project(data: object) -> InvitationProjectType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                project_type_0 = InvitationProjectType0.from_dict(data)



                return project_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(InvitationProjectType0 | None, data)

        project = _parse_project(d.pop("project"))


        def _parse_role(data: object) -> None | ProjectRole:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                role_type_0 = ProjectRole(data)



                return role_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ProjectRole, data)

        role = _parse_role(d.pop("role"))


        def _parse_invited_by(data: object) -> InvitationInvitedByType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                invited_by_type_0 = InvitationInvitedByType0.from_dict(data)



                return invited_by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(InvitationInvitedByType0 | None, data)

        invited_by = _parse_invited_by(d.pop("invitedBy"))


        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        expires_at = datetime.datetime.fromisoformat(d.pop("expiresAt"))




        def _parse_accepted_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                accepted_at_type_0 = datetime.datetime.fromisoformat(data)



                return accepted_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        accepted_at = _parse_accepted_at(d.pop("acceptedAt"))


        def _parse_revoked_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                revoked_at_type_0 = datetime.datetime.fromisoformat(data)



                return revoked_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        revoked_at = _parse_revoked_at(d.pop("revokedAt"))


        invitation = cls(
            id=id,
            email=email,
            project=project,
            role=role,
            invited_by=invited_by,
            created_at=created_at,
            expires_at=expires_at,
            accepted_at=accepted_at,
            revoked_at=revoked_at,
        )

        return invitation

