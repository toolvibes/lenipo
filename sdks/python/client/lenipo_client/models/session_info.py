from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="SessionInfo")



@_attrs_define
class SessionInfo:
    """ 
        Attributes:
            id (str):
            current (bool):
            created_at (datetime.datetime):
            last_seen_at (datetime.datetime):
            expires_at (datetime.datetime):
            ip (None | str):
            user_agent (None | str):
     """

    id: str
    current: bool
    created_at: datetime.datetime
    last_seen_at: datetime.datetime
    expires_at: datetime.datetime
    ip: None | str
    user_agent: None | str





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        current = self.current

        created_at = self.created_at.isoformat()

        last_seen_at = self.last_seen_at.isoformat()

        expires_at = self.expires_at.isoformat()

        ip: None | str
        ip = self.ip

        user_agent: None | str
        user_agent = self.user_agent


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "current": current,
            "createdAt": created_at,
            "lastSeenAt": last_seen_at,
            "expiresAt": expires_at,
            "ip": ip,
            "userAgent": user_agent,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        current = d.pop("current")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        last_seen_at = datetime.datetime.fromisoformat(d.pop("lastSeenAt"))




        expires_at = datetime.datetime.fromisoformat(d.pop("expiresAt"))




        def _parse_ip(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        ip = _parse_ip(d.pop("ip"))


        def _parse_user_agent(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        user_agent = _parse_user_agent(d.pop("userAgent"))


        session_info = cls(
            id=id,
            current=current,
            created_at=created_at,
            last_seen_at=last_seen_at,
            expires_at=expires_at,
            ip=ip,
            user_agent=user_agent,
        )

        return session_info

