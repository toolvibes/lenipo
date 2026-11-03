from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="MailHandler")



@_attrs_define
class MailHandler:
    """ 
        Attributes:
            enabled (bool):
            host (str):
            port (int):
            secure (bool):
            username (str):
            has_password (bool):
            folder (str):
            done_folder (str):
            issue_type (str):
            last_run_at (datetime.datetime | None):
            last_result (None | str):
     """

    enabled: bool
    host: str
    port: int
    secure: bool
    username: str
    has_password: bool
    folder: str
    done_folder: str
    issue_type: str
    last_run_at: datetime.datetime | None
    last_result: None | str





    def to_dict(self) -> dict[str, Any]:
        enabled = self.enabled

        host = self.host

        port = self.port

        secure = self.secure

        username = self.username

        has_password = self.has_password

        folder = self.folder

        done_folder = self.done_folder

        issue_type = self.issue_type

        last_run_at: None | str
        if isinstance(self.last_run_at, datetime.datetime):
            last_run_at = self.last_run_at.isoformat()
        else:
            last_run_at = self.last_run_at

        last_result: None | str
        last_result = self.last_result


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "enabled": enabled,
            "host": host,
            "port": port,
            "secure": secure,
            "username": username,
            "hasPassword": has_password,
            "folder": folder,
            "doneFolder": done_folder,
            "issueType": issue_type,
            "lastRunAt": last_run_at,
            "lastResult": last_result,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        enabled = d.pop("enabled")

        host = d.pop("host")

        port = d.pop("port")

        secure = d.pop("secure")

        username = d.pop("username")

        has_password = d.pop("hasPassword")

        folder = d.pop("folder")

        done_folder = d.pop("doneFolder")

        issue_type = d.pop("issueType")

        def _parse_last_run_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_run_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_run_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_run_at = _parse_last_run_at(d.pop("lastRunAt"))


        def _parse_last_result(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        last_result = _parse_last_result(d.pop("lastResult"))


        mail_handler = cls(
            enabled=enabled,
            host=host,
            port=port,
            secure=secure,
            username=username,
            has_password=has_password,
            folder=folder,
            done_folder=done_folder,
            issue_type=issue_type,
            last_run_at=last_run_at,
            last_result=last_result,
        )

        return mail_handler

