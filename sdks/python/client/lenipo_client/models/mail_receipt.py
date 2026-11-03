from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="MailReceipt")



@_attrs_define
class MailReceipt:
    """ 
        Attributes:
            message_id (str):
            issue_key (None | str):
            outcome (str):
            received_at (datetime.datetime):
     """

    message_id: str
    issue_key: None | str
    outcome: str
    received_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        message_id = self.message_id

        issue_key: None | str
        issue_key = self.issue_key

        outcome = self.outcome

        received_at = self.received_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "messageId": message_id,
            "issueKey": issue_key,
            "outcome": outcome,
            "receivedAt": received_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        message_id = d.pop("messageId")

        def _parse_issue_key(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        issue_key = _parse_issue_key(d.pop("issueKey"))


        outcome = d.pop("outcome")

        received_at = datetime.datetime.fromisoformat(d.pop("receivedAt"))




        mail_receipt = cls(
            message_id=message_id,
            issue_key=issue_key,
            outcome=outcome,
            received_at=received_at,
        )

        return mail_receipt

