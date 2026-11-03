from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.user_summary_status import UserSummaryStatus
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="UserSummary")



@_attrs_define
class UserSummary:
    """ 
        Attributes:
            id (UUID):
            email (str):
            display_name (str):
            status (UserSummaryStatus):
            groups (list[str]):
            external (bool):
            agent (bool):
     """

    id: UUID
    email: str
    display_name: str
    status: UserSummaryStatus
    groups: list[str]
    external: bool
    agent: bool





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        email = self.email

        display_name = self.display_name

        status = self.status.value

        groups = self.groups



        external = self.external

        agent = self.agent


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "email": email,
            "displayName": display_name,
            "status": status,
            "groups": groups,
            "external": external,
            "agent": agent,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        email = d.pop("email")

        display_name = d.pop("displayName")

        status = UserSummaryStatus(d.pop("status"))




        groups = cast(list[str], d.pop("groups"))


        external = d.pop("external")

        agent = d.pop("agent")

        user_summary = cls(
            id=id,
            email=email,
            display_name=display_name,
            status=status,
            groups=groups,
            external=external,
            agent=agent,
        )

        return user_summary

