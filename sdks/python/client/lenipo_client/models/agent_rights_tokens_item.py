from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="AgentRightsTokensItem")



@_attrs_define
class AgentRightsTokensItem:
    """ 
        Attributes:
            name (str):
            scopes (list[str]):
            expires_at (datetime.datetime | None):
            last_used_at (datetime.datetime | None):
     """

    name: str
    scopes: list[str]
    expires_at: datetime.datetime | None
    last_used_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        scopes = self.scopes



        expires_at: None | str
        if isinstance(self.expires_at, datetime.datetime):
            expires_at = self.expires_at.isoformat()
        else:
            expires_at = self.expires_at

        last_used_at: None | str
        if isinstance(self.last_used_at, datetime.datetime):
            last_used_at = self.last_used_at.isoformat()
        else:
            last_used_at = self.last_used_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "name": name,
            "scopes": scopes,
            "expiresAt": expires_at,
            "lastUsedAt": last_used_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        scopes = cast(list[str], d.pop("scopes"))


        def _parse_expires_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                expires_at_type_0 = datetime.datetime.fromisoformat(data)



                return expires_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        expires_at = _parse_expires_at(d.pop("expiresAt"))


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


        agent_rights_tokens_item = cls(
            name=name,
            scopes=scopes,
            expires_at=expires_at,
            last_used_at=last_used_at,
        )

        return agent_rights_tokens_item

