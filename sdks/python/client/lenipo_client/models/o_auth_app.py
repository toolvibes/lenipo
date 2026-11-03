from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="OAuthApp")



@_attrs_define
class OAuthApp:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            redirect_uris (list[str]):
            confidential (bool):
            connections (int):
            created_at (datetime.datetime):
            last_used_at (datetime.datetime | None):
     """

    id: UUID
    name: str
    description: str
    redirect_uris: list[str]
    confidential: bool
    connections: int
    created_at: datetime.datetime
    last_used_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        description = self.description

        redirect_uris = self.redirect_uris



        confidential = self.confidential

        connections = self.connections

        created_at = self.created_at.isoformat()

        last_used_at: None | str
        if isinstance(self.last_used_at, datetime.datetime):
            last_used_at = self.last_used_at.isoformat()
        else:
            last_used_at = self.last_used_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "redirectUris": redirect_uris,
            "confidential": confidential,
            "connections": connections,
            "createdAt": created_at,
            "lastUsedAt": last_used_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        redirect_uris = cast(list[str], d.pop("redirectUris"))


        confidential = d.pop("confidential")

        connections = d.pop("connections")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        def _parse_last_used_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_used_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_used_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_used_at = _parse_last_used_at(d.pop("lastUsedAt"))


        o_auth_app = cls(
            id=id,
            name=name,
            description=description,
            redirect_uris=redirect_uris,
            confidential=confidential,
            connections=connections,
            created_at=created_at,
            last_used_at=last_used_at,
        )

        return o_auth_app

