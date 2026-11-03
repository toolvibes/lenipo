from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.invitation_preview_project_type_0 import InvitationPreviewProjectType0





T = TypeVar("T", bound="InvitationPreview")



@_attrs_define
class InvitationPreview:
    """ 
        Attributes:
            email (str):
            instance_name (str):
            project (InvitationPreviewProjectType0 | None):
            invited_by (None | str):
            registration (bool):
            setup (bool):
     """

    email: str
    instance_name: str
    project: InvitationPreviewProjectType0 | None
    invited_by: None | str
    registration: bool
    setup: bool





    def to_dict(self) -> dict[str, Any]:
        from ..models.invitation_preview_project_type_0 import InvitationPreviewProjectType0 # noqa: PLC0415
        email = self.email

        instance_name = self.instance_name

        project: dict[str, Any] | None
        if isinstance(self.project, InvitationPreviewProjectType0):
            project = self.project.to_dict()
        else:
            project = self.project

        invited_by: None | str
        invited_by = self.invited_by

        registration = self.registration

        setup = self.setup


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "email": email,
            "instanceName": instance_name,
            "project": project,
            "invitedBy": invited_by,
            "registration": registration,
            "setup": setup,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.invitation_preview_project_type_0 import InvitationPreviewProjectType0 # noqa: PLC0415
        d = dict(src_dict)
        email = d.pop("email")

        instance_name = d.pop("instanceName")

        def _parse_project(data: object) -> InvitationPreviewProjectType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                project_type_0 = InvitationPreviewProjectType0.from_dict(data)



                return project_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(InvitationPreviewProjectType0 | None, data)

        project = _parse_project(d.pop("project"))


        def _parse_invited_by(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        invited_by = _parse_invited_by(d.pop("invitedBy"))


        registration = d.pop("registration")

        setup = d.pop("setup")

        invitation_preview = cls(
            email=email,
            instance_name=instance_name,
            project=project,
            invited_by=invited_by,
            registration=registration,
            setup=setup,
        )

        return invitation_preview

