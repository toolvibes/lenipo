from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.git_provider import GitProvider
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="GitConnection")



@_attrs_define
class GitConnection:
    """ 
        Attributes:
            id (UUID):
            name (str):
            provider (GitProvider):
            webhook_url (str):
            created_at (datetime.datetime):
            last_event_at (datetime.datetime | None):
            last_error (None | str):
     """

    id: UUID
    name: str
    provider: GitProvider
    webhook_url: str
    created_at: datetime.datetime
    last_event_at: datetime.datetime | None
    last_error: None | str





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        provider = self.provider.value

        webhook_url = self.webhook_url

        created_at = self.created_at.isoformat()

        last_event_at: None | str
        if isinstance(self.last_event_at, datetime.datetime):
            last_event_at = self.last_event_at.isoformat()
        else:
            last_event_at = self.last_event_at

        last_error: None | str
        last_error = self.last_error


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "provider": provider,
            "webhookUrl": webhook_url,
            "createdAt": created_at,
            "lastEventAt": last_event_at,
            "lastError": last_error,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        provider = GitProvider(d.pop("provider"))




        webhook_url = d.pop("webhookUrl")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        def _parse_last_event_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_event_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_event_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_event_at = _parse_last_event_at(d.pop("lastEventAt"))


        def _parse_last_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        last_error = _parse_last_error(d.pop("lastError"))


        git_connection = cls(
            id=id,
            name=name,
            provider=provider,
            webhook_url=webhook_url,
            created_at=created_at,
            last_event_at=last_event_at,
            last_error=last_error,
        )

        return git_connection

