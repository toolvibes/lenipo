from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="InvitationsAcceptResponse200")



@_attrs_define
class InvitationsAcceptResponse200:
    """ 
        Attributes:
            project_key (None | str):
     """

    project_key: None | str





    def to_dict(self) -> dict[str, Any]:
        project_key: None | str
        project_key = self.project_key


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "projectKey": project_key,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_project_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        project_key = _parse_project_key(d.pop("projectKey"))


        invitations_accept_response_200 = cls(
            project_key=project_key,
        )

        return invitations_accept_response_200

